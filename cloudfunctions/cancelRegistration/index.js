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

function isBenchTeam(team) {
  return team && team.teamType === 'bench';
}

function isActiveBenchTeam(team) {
  return isBenchTeam(team) && team.status !== 'inactive' && normalizeCount(team.maxMembers) > 0;
}

function getRegistrationDocumentId(registration) {
  if (registration && registration._id) {
    return registration._id;
  }

  if (registration && registration.activityId && registration.userOpenId) {
    return `${registration.activityId}_${registration.userOpenId}`;
  }

  return '';
}

function compareBenchQueue(left, right) {
  const leftJoinedAt = String(left && left.joinedAt ? left.joinedAt : '');
  const rightJoinedAt = String(right && right.joinedAt ? right.joinedAt : '');

  if (leftJoinedAt !== rightJoinedAt) {
    return leftJoinedAt.localeCompare(rightJoinedAt);
  }

  return getRegistrationDocumentId(left).localeCompare(getRegistrationDocumentId(right));
}

async function queryTransactionCollection(transaction, collectionName, query) {
  const collection = transaction.collection(collectionName);

  if (!collection || typeof collection.where !== 'function') {
    return { data: [] };
  }

  return collection.where(query).get();
}

async function findBenchPromotionCandidate(transaction, activityId) {
  const teamsRes = await queryTransactionCollection(transaction, 'activity_teams', { activityId });
  const benchTeams = (teamsRes.data || []).filter(isActiveBenchTeam);
  const benchTeamById = benchTeams.reduce((map, team) => {
    const id = team && team._id ? team._id : '';
    if (id) {
      map.set(id, team);
    }
    return map;
  }, new Map());

  if (benchTeamById.size === 0) {
    return null;
  }

  const registrationRes = await queryTransactionCollection(transaction, 'registrations', {
    activityId,
    status: 'joined'
  });
  const promotedRegistration = (registrationRes.data || [])
    .filter(registration => benchTeamById.has(registration.teamId))
    .sort(compareBenchQueue)[0] || null;
  const promotedRegistrationId = getRegistrationDocumentId(promotedRegistration);

  if (!promotedRegistration || !promotedRegistrationId) {
    return null;
  }

  return {
    registration: promotedRegistration,
    registrationId: promotedRegistrationId,
    fromTeam: benchTeamById.get(promotedRegistration.teamId)
  };
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

    const cancelCount = normalizeCount(registrationRes.data.cancelCount) + 1;
    const joinedCountAfter = Math.max(activityRes.data.joinedCount - 1, 0);
    const promotion = !isBenchTeam(teamRes.data)
      ? await findBenchPromotionCandidate(transaction, event.activityId)
      : null;

    await transaction.collection('registrations').doc(registrationId).update({
      data: {
        status: 'cancelled',
        cancelledAt: stamp,
        cancelCount,
        updatedAt: stamp
      }
    });

    await transaction.collection('activities').doc(event.activityId).update({
      data: {
        joinedCount: joinedCountAfter,
        updatedAt: stamp
      }
    });

    if (promotion) {
      await transaction.collection('registrations').doc(promotion.registrationId).update({
        data: {
          teamId: registrationRes.data.teamId,
          updatedAt: stamp
        }
      });

      await transaction.collection('activity_teams').doc(promotion.registration.teamId).update({
        data: {
          joinedCount: Math.max(normalizeCount(promotion.fromTeam.joinedCount) - 1, 0)
        }
      });
    } else {
      await transaction.collection('activity_teams').doc(registrationRes.data.teamId).update({
        data: {
          joinedCount: Math.max(teamRes.data.joinedCount - 1, 0)
        }
      });
    }

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

    if (promotion) {
      await writeActivityLog(transaction, {
        activityId: event.activityId,
        action: 'registration_auto_promoted',
        operatorOpenId: openid,
        targetOpenId: promotion.registration.userOpenId || '',
        registrationId: promotion.registrationId,
        teamId: registrationRes.data.teamId || '',
        fromTeamId: promotion.registration.teamId || '',
        toTeamId: registrationRes.data.teamId || '',
        before: {
          status: 'joined',
          teamId: promotion.registration.teamId || ''
        },
        after: {
          status: 'joined',
          teamId: registrationRes.data.teamId || '',
          cancelledRegistrationId: registrationId,
          queueOrder: 1
        },
        createdAt: stamp
      });
    }

    const activity = {
      ...activityRes.data,
      _id: event.activityId
    };
    return {
      registrationId,
      status: 'cancelled',
      promotedRegistrationId: promotion ? promotion.registrationId : '',
      promotedTeamId: promotion ? registrationRes.data.teamId || '' : '',
      promotedFromTeamId: promotion ? promotion.registration.teamId || '' : '',
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
