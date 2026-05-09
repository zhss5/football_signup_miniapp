const { COLLECTIONS } = require('./collections');
const { ensureCloudCollections } = require('./database');
const { canEditActivity } = require('./roles');

const TEMPLATE_KEY = 'activity_notice';
const REGISTRATION_CHANGE_TYPES = new Set(['registration_joined', 'registration_cancelled']);
const NOTIFICATION_COLLECTIONS = [
  COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS,
  COLLECTIONS.NOTIFICATION_LOGS
];
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
let collectionBootstrapPromise = null;

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

  const chinaTime = new Date(date.getTime() + CHINA_TIME_OFFSET_MS);

  return `${chinaTime.getUTCFullYear()}-${pad(chinaTime.getUTCMonth() + 1)}-${pad(chinaTime.getUTCDate())} ${pad(chinaTime.getUTCHours())}:${pad(chinaTime.getUTCMinutes())}`;
}

function buildManagerRegistrationMessageData(activity, change = {}) {
  const actorName = clip(change.actorName || '\u961f\u5458', 10);
  const actionText =
    change.changeType === 'registration_cancelled'
      ? `${actorName} \u5df2\u9000\u51fa`
      : `${actorName} \u5df2\u62a5\u540d`;

  return {
    time2: {
      value: formatDateTime(activity.startAt)
    },
    thing3: {
      value: clip(activity.title || '\u8db3\u7403\u6d3b\u52a8', 20)
    },
    thing6: {
      value: '\u62a5\u540d\u53d8\u66f4'
    },
    thing7: {
      value: clip(actionText, 20)
    }
  };
}

function ensureNotificationCollections(db, deps = {}) {
  if (deps.ensureNotificationCollections) {
    return deps.ensureNotificationCollections(db);
  }

  if (!collectionBootstrapPromise) {
    collectionBootstrapPromise = ensureCloudCollections(db, NOTIFICATION_COLLECTIONS).catch(error => {
      collectionBootstrapPromise = null;
      throw error;
    });
  }

  return collectionBootstrapPromise;
}

function getSendSubscribeMessage(cloud, deps = {}) {
  if (typeof deps.sendSubscribeMessage === 'function') {
    return deps.sendSubscribeMessage;
  }

  if (
    cloud &&
    cloud.openapi &&
    cloud.openapi.subscribeMessage &&
    typeof cloud.openapi.subscribeMessage.send === 'function'
  ) {
    return payload => cloud.openapi.subscribeMessage.send(payload);
  }

  return null;
}

async function getUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

async function getAcceptedManagerSubscriptions(db, activity, actorOpenId) {
  const result = await db
    .collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS)
    .where({
      activityId: activity._id,
      templateKey: TEMPLATE_KEY,
      status: 'accepted'
    })
    .get();
  const managerSubscriptions = [];

  for (const subscription of result.data || []) {
    if (!subscription.userOpenId || !subscription.templateId) {
      continue;
    }

    if (subscription.userOpenId === actorOpenId) {
      continue;
    }

    const user = await getUser(db, subscription.userOpenId);
    if (canEditActivity(activity, user, subscription.userOpenId)) {
      managerSubscriptions.push(subscription);
    }
  }

  return managerSubscriptions;
}

async function addNotificationLog(db, data) {
  await db.collection(COLLECTIONS.NOTIFICATION_LOGS).add({
    data
  });
}

async function notifyActivityManagers(db, payload, deps = {}) {
  if (!payload || !payload.activity || !payload.activity._id) {
    return {
      totalRecipients: 0,
      sent: 0,
      failed: 0,
      skipped: 0
    };
  }

  if (!REGISTRATION_CHANGE_TYPES.has(payload.changeType)) {
    throw new Error('Unsupported manager notification type');
  }

  await ensureNotificationCollections(db, deps);

  const subscriptions = await getAcceptedManagerSubscriptions(
    db,
    payload.activity,
    payload.actorOpenId
  );
  const sendSubscribeMessage = getSendSubscribeMessage(deps.cloud, deps);
  const page = `pages/activity-detail/index?activityId=${payload.activity._id}`;
  const data = buildManagerRegistrationMessageData(payload.activity, payload);
  const summary = {
    totalRecipients: subscriptions.length,
    sent: 0,
    failed: 0,
    skipped: 0
  };

  for (const subscription of subscriptions) {
    if (!sendSubscribeMessage) {
      summary.skipped += 1;
      await addNotificationLog(db, {
        activityId: payload.activity._id,
        actorOpenId: payload.actorOpenId,
        recipientOpenId: subscription.userOpenId,
        notificationType: payload.changeType,
        templateId: subscription.templateId,
        status: 'skipped',
        reason: 'subscribe-message-api-unavailable',
        createdAt: payload.stamp
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
        activityId: payload.activity._id,
        actorOpenId: payload.actorOpenId,
        actorName: payload.actorName || '',
        recipientOpenId: subscription.userOpenId,
        notificationType: payload.changeType,
        templateId: subscription.templateId,
        status: 'sent',
        createdAt: payload.stamp
      });
    } catch (error) {
      summary.failed += 1;
      await addNotificationLog(db, {
        activityId: payload.activity._id,
        actorOpenId: payload.actorOpenId,
        actorName: payload.actorName || '',
        recipientOpenId: subscription.userOpenId,
        notificationType: payload.changeType,
        templateId: subscription.templateId,
        status: 'failed',
        errorMessage: error && error.message ? error.message : String(error),
        createdAt: payload.stamp
      });
    }
  }

  return summary;
}

module.exports = {
  buildManagerRegistrationMessageData,
  notifyActivityManagers
};
