const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { nowIso } = require('./time');
const { buildManagerRegistrationMessageData } = require('./manager-notifications');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MANAGER_REGISTRATION_TEMPLATE_KEY = 'manager_registration_notice';
const REGISTRATION_CANCELLED_NOTIFICATION = 'registration_cancelled';
const DEFAULT_LATE_CANCELLATION_NOTICE_WINDOW_HOURS = 6;

function normalizeCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

async function writeActivityLog(transaction, data) {
  await transaction.collection(COLLECTIONS.ACTIVITY_LOGS).add({ data });
}

function normalizeNoticeWindowHours(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_LATE_CANCELLATION_NOTICE_WINDOW_HOURS;
  }

  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) {
    return DEFAULT_LATE_CANCELLATION_NOTICE_WINDOW_HOURS;
  }

  return Math.floor(hours);
}

function shouldNotifyLateCancellation(activity, stamp) {
  const windowHours = normalizeNoticeWindowHours(
    activity && activity.lateCancellationNoticeWindowHours
  );
  if (windowHours <= 0) {
    return false;
  }

  const startAt = Date.parse(activity && activity.startAt);
  const cancelledAt = Date.parse(stamp);
  if (!Number.isFinite(startAt) || !Number.isFinite(cancelledAt)) {
    return false;
  }

  const diffMs = startAt - cancelledAt;
  return diffMs >= 0 && diffMs <= windowHours * 60 * 60 * 1000;
}

function getSendSubscribeMessage(cloudApi, deps = {}) {
  if (typeof deps.sendSubscribeMessage === 'function') {
    return deps.sendSubscribeMessage;
  }

  if (
    cloudApi &&
    cloudApi.openapi &&
    cloudApi.openapi.subscribeMessage &&
    typeof cloudApi.openapi.subscribeMessage.send === 'function'
  ) {
    return payload => cloudApi.openapi.subscribeMessage.send(payload);
  }

  return null;
}

function getSubscriptionDocumentId(subscription) {
  if (subscription && subscription._id) {
    return subscription._id;
  }

  if (subscription && subscription.activityId && subscription.userOpenId && subscription.templateKey) {
    return `${subscription.activityId}_${subscription.userOpenId}_${subscription.templateKey}`;
  }

  return '';
}

async function addNotificationLog(db, data) {
  await db.collection(COLLECTIONS.NOTIFICATION_LOGS).add({ data });
}

async function consumeSubscription(db, subscription, stamp, status, errorMessage = '') {
  const documentId = getSubscriptionDocumentId(subscription);
  if (!documentId) {
    return;
  }

  const data = {
    status: 'consumed',
    subscribed: false,
    consumedAt: stamp,
    updatedAt: stamp,
    lastSendStatus: status
  };

  if (errorMessage) {
    data.lastErrorMessage = String(errorMessage).slice(0, 200);
  }

  await db
    .collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS)
    .doc(documentId)
    .update({ data })
    .catch(() => null);
}

async function notifyActivityOrganizerCancellation(db, payload, deps = {}) {
  const activity = payload && payload.activity ? payload.activity : {};
  const recipientOpenId = String(activity.organizerOpenId || '').trim();
  const baseLog = {
    activityId: activity._id || '',
    actorOpenId: payload.actorOpenId || '',
    actorName: payload.actorName || '',
    recipientOpenId,
    notificationType: REGISTRATION_CANCELLED_NOTIFICATION,
    templateKey: MANAGER_REGISTRATION_TEMPLATE_KEY,
    createdAt: payload.stamp
  };

  if (!activity._id || !recipientOpenId) {
    return {
      recipientOpenId,
      status: 'skipped',
      reason: 'missing-organizer'
    };
  }

  if (recipientOpenId === payload.actorOpenId) {
    await addNotificationLog(db, {
      ...baseLog,
      status: 'skipped',
      reason: 'actor-is-organizer'
    });
    return {
      recipientOpenId,
      status: 'skipped',
      reason: 'actor-is-organizer'
    };
  }

  const subscriptions = await db
    .collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS)
    .where({
      activityId: activity._id,
      userOpenId: recipientOpenId,
      templateKey: MANAGER_REGISTRATION_TEMPLATE_KEY,
      status: 'accepted'
    })
    .get();
  const subscription = (subscriptions.data || [])[0];

  if (!subscription || !subscription.templateId) {
    await addNotificationLog(db, {
      ...baseLog,
      status: 'skipped',
      reason: 'no-accepted-subscription'
    });
    return {
      recipientOpenId,
      status: 'skipped',
      reason: 'no-accepted-subscription'
    };
  }

  const sendSubscribeMessage = getSendSubscribeMessage(deps.cloud, deps);
  if (!sendSubscribeMessage) {
    await addNotificationLog(db, {
      ...baseLog,
      templateId: subscription.templateId,
      status: 'skipped',
      reason: 'subscribe-message-api-unavailable'
    });
    return {
      recipientOpenId,
      status: 'skipped',
      reason: 'subscribe-message-api-unavailable'
    };
  }

  try {
    await sendSubscribeMessage({
      touser: recipientOpenId,
      templateId: subscription.templateId,
      page: `pages/activity-detail/index?activityId=${activity._id}`,
      data: buildManagerRegistrationMessageData(activity, payload),
      miniprogramState: 'formal',
      lang: 'zh_CN'
    });
    await consumeSubscription(db, subscription, payload.stamp, 'sent');
    await addNotificationLog(db, {
      ...baseLog,
      templateId: subscription.templateId,
      status: 'sent'
    });
    return {
      recipientOpenId,
      status: 'sent'
    };
  } catch (error) {
    const errorMessage = error && error.message ? error.message : String(error);
    await consumeSubscription(db, subscription, payload.stamp, 'failed', errorMessage);
    await addNotificationLog(db, {
      ...baseLog,
      templateId: subscription.templateId,
      status: 'failed',
      errorMessage
    });
    return {
      recipientOpenId,
      status: 'failed',
      errorMessage
    };
  }
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runCancel) {
    return deps.runCancel(event, openid);
  }

  const db = cloud.database();
  const registrationId = `${event.activityId}_${openid}`;
  const stamp = nowIso(deps.now);

  const transactionResult = await db.runTransaction(async transaction => {
    const registrationRes = await transaction.collection('registrations').doc(registrationId).get();

    if (!registrationRes.data || registrationRes.data.status !== 'joined') {
      throw businessError('No active registration to cancel');
    }

    const activityRes = await transaction.collection('activities').doc(event.activityId).get();
    const teamRes = await transaction.collection('activity_teams').doc(registrationRes.data.teamId).get();

    if (activityRes.data.status !== 'published') {
      throw businessError('Signup can no longer be cancelled');
    }

    const deadline = Date.parse(activityRes.data.signupDeadlineAt || '');
    if (Number.isFinite(deadline) && Date.parse(stamp) > deadline) {
      throw businessError('Signup can no longer be cancelled');
    }

    await transaction.collection('registrations').doc(registrationId).update({
      data: {
        status: 'cancelled',
        cancelledAt: stamp,
        cancelCount: normalizeCount(registrationRes.data.cancelCount) + 1,
        updatedAt: stamp
      }
    });

    await transaction.collection('activities').doc(event.activityId).update({
      data: {
        joinedCount: Math.max(activityRes.data.joinedCount - 1, 0),
        updatedAt: stamp
      }
    });

    await transaction.collection('activity_teams').doc(registrationRes.data.teamId).update({
      data: {
        joinedCount: Math.max(teamRes.data.joinedCount - 1, 0)
      }
    });

    const cancelCount = normalizeCount(registrationRes.data.cancelCount) + 1;
    const joinedCountAfter = Math.max(activityRes.data.joinedCount - 1, 0);
    await writeActivityLog(transaction, {
      activityId: event.activityId,
      action: 'signup_cancelled',
      operatorOpenId: openid,
      targetOpenId: registrationRes.data.userOpenId || openid,
      registrationId,
      teamId: registrationRes.data.teamId || '',
      before: {
        status: 'joined',
        teamId: registrationRes.data.teamId || ''
      },
      after: {
        status: 'cancelled',
        cancelCount
      },
      createdAt: stamp
    });

    const activity = {
      ...activityRes.data,
      _id: event.activityId
    };
    return {
      registrationId,
      status: 'cancelled',
      lateCancellationNotice: shouldNotifyLateCancellation(activity, stamp)
        ? {
            activity,
            actorOpenId: openid,
            actorName: registrationRes.data.signupName || '',
            changeType: REGISTRATION_CANCELLED_NOTIFICATION,
            joinedCountAfter,
            signupLimitTotal: normalizeCount(activityRes.data.signupLimitTotal),
            stamp
          }
        : null
    };
  });

  const { lateCancellationNotice, ...response } = transactionResult;

  if (!lateCancellationNotice) {
    return response;
  }

  const notify = deps.notifyActivityOrganizerCancellation || notifyActivityOrganizerCancellation;
  const noticeResult = await notify(db, lateCancellationNotice, { ...deps, cloud }).catch(error => ({
    recipientOpenId: lateCancellationNotice.activity.organizerOpenId || '',
    status: 'failed',
    errorMessage: error && error.message ? error.message : String(error)
  }));

  return {
    ...response,
    lateCancellationNotice: {
      attempted: true,
      recipientOpenId: noticeResult.recipientOpenId || lateCancellationNotice.activity.organizerOpenId || '',
      status: noticeResult.status || 'skipped'
    }
  };
}

module.exports = {
  main,
  notifyActivityOrganizerCancellation,
  shouldNotifyLateCancellation
};
