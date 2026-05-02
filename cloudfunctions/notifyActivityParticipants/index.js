const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const TEMPLATE_KEY = 'activity_notice';
const NOTIFICATION_TYPES = new Set(['proceeding', 'cancelled']);

function clip(value, maxLength) {
  const text = String(value || '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildMessageData(activity, notificationType) {
  const statusText = notificationType === 'proceeding' ? '确认举行' : '已取消';
  const note =
    notificationType === 'proceeding'
      ? '活动已确认举行，请准时参加'
      : '活动已取消，请留意后续安排';

  return {
    thing1: {
      value: clip(activity.title || '足球活动', 20)
    },
    time2: {
      value: formatDateTime(activity.startAt)
    },
    thing3: {
      value: clip(activity.addressName || activity.addressText || '活动地点', 20)
    },
    phrase4: {
      value: clip(statusText, 5)
    },
    thing5: {
      value: clip(note, 20)
    }
  };
}

async function getCurrentUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

async function assertCanNotify(db, activity, openid) {
  const user = await getCurrentUser(db, openid);

  if (!canEditActivity(activity, user, openid)) {
    throw businessError('Only the organizer or an admin can notify participants');
  }
}

function getSendSubscribeMessage(deps) {
  if (typeof deps.sendSubscribeMessage === 'function') {
    return deps.sendSubscribeMessage;
  }

  if (
    cloud.openapi &&
    cloud.openapi.subscribeMessage &&
    typeof cloud.openapi.subscribeMessage.send === 'function'
  ) {
    return payload => cloud.openapi.subscribeMessage.send(payload);
  }

  return null;
}

async function updateActivityState(db, activityId, notificationType, openid, stamp) {
  const updateData =
    notificationType === 'proceeding'
      ? {
          confirmStatus: 'confirmed',
          confirmedAt: stamp,
          confirmedByOpenId: openid,
          updatedAt: stamp
        }
      : {
          status: 'cancelled',
          cancelledAt: stamp,
          cancelledByOpenId: openid,
          updatedAt: stamp
        };

  await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).update({
    data: updateData
  });

  return updateData;
}

async function getJoinedOpenIds(db, activityId) {
  const result = await db
    .collection(COLLECTIONS.REGISTRATIONS)
    .where({
      activityId,
      status: 'joined'
    })
    .get();

  return new Set((result.data || []).map(item => item.userOpenId).filter(Boolean));
}

async function getAcceptedSubscriptions(db, activityId, joinedOpenIds) {
  const result = await db
    .collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS)
    .where({
      activityId,
      templateKey: TEMPLATE_KEY,
      status: 'accepted'
    })
    .get();

  return (result.data || []).filter(
    item => item.userOpenId && item.templateId && joinedOpenIds.has(item.userOpenId)
  );
}

async function hasSentLog(db, activityId, notificationType, recipientOpenId) {
  const result = await db
    .collection(COLLECTIONS.NOTIFICATION_LOGS)
    .where({
      activityId,
      notificationType,
      recipientOpenId,
      status: 'sent'
    })
    .get();

  return (result.data || []).length > 0;
}

async function addNotificationLog(db, data) {
  await db.collection(COLLECTIONS.NOTIFICATION_LOGS).add({
    data
  });
}

async function sendNotifications(db, activity, subscriptions, notificationType, stamp, deps) {
  const sendSubscribeMessage = getSendSubscribeMessage(deps);
  const page = `pages/activity-detail/index?activityId=${activity._id}`;
  const data = buildMessageData(activity, notificationType);
  const summary = {
    sent: 0,
    failed: 0,
    skipped: 0
  };

  for (const subscription of subscriptions) {
    const duplicate = await hasSentLog(
      db,
      activity._id,
      notificationType,
      subscription.userOpenId
    );

    if (duplicate) {
      summary.skipped += 1;
      continue;
    }

    if (!sendSubscribeMessage) {
      summary.skipped += 1;
      await addNotificationLog(db, {
        activityId: activity._id,
        recipientOpenId: subscription.userOpenId,
        notificationType,
        status: 'skipped',
        reason: 'subscribe-message-api-unavailable',
        createdAt: stamp
      });
      continue;
    }

    try {
      await sendSubscribeMessage({
        touser: subscription.userOpenId,
        templateId: subscription.templateId,
        page,
        data,
        miniprogramState: 'formal',
        lang: 'zh_CN'
      });
      summary.sent += 1;
      await addNotificationLog(db, {
        activityId: activity._id,
        recipientOpenId: subscription.userOpenId,
        notificationType,
        templateId: subscription.templateId,
        status: 'sent',
        createdAt: stamp
      });
    } catch (error) {
      summary.failed += 1;
      await addNotificationLog(db, {
        activityId: activity._id,
        recipientOpenId: subscription.userOpenId,
        notificationType,
        templateId: subscription.templateId,
        status: 'failed',
        errorMessage: error && error.message ? error.message : String(error),
        createdAt: stamp
      });
    }
  }

  return summary;
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (!event.activityId) {
    throw businessError('activityId is required');
  }

  if (!NOTIFICATION_TYPES.has(event.notificationType)) {
    throw businessError('Unsupported notification type');
  }

  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const activityRes = await db.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).get();
  const activity = activityRes.data;

  if (!activity) {
    throw businessError('Activity not found');
  }

  await assertCanNotify(db, activity, openid);

  if (event.notificationType === 'proceeding' && activity.status !== 'published') {
    throw businessError('Only published activities can be confirmed');
  }

  const stamp = nowIso(deps.now);
  const updateData = await updateActivityState(
    db,
    event.activityId,
    event.notificationType,
    openid,
    stamp
  );
  const activityForMessage = {
    ...activity,
    ...updateData,
    _id: event.activityId
  };
  const joinedOpenIds = await getJoinedOpenIds(db, event.activityId);
  const subscriptions = await getAcceptedSubscriptions(db, event.activityId, joinedOpenIds);
  const sendSummary = await sendNotifications(
    db,
    activityForMessage,
    subscriptions,
    event.notificationType,
    stamp,
    deps
  );

  return {
    activityId: event.activityId,
    notificationType: event.notificationType,
    confirmed: event.notificationType === 'proceeding',
    cancelled: event.notificationType === 'cancelled',
    totalRecipients: subscriptions.length,
    ...sendSummary
  };
}

module.exports = {
  buildMessageData,
  main
};
