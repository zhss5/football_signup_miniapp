const { COLLECTIONS } = require('./collections');
const { ensureCloudCollections } = require('./database');
const { canEditActivity } = require('./roles');

const TEMPLATE_KEY = 'manager_registration_notice';
const REGISTRATION_CHANGE_TYPES = new Set(['registration_joined', 'registration_cancelled']);
const NOTIFICATION_COLLECTIONS = [
  COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS,
  COLLECTIONS.NOTIFICATION_LOGS
];
const COLLECTION_BATCH_SIZE = 100;
let collectionBootstrapPromise = null;

function clip(value, maxLength) {
  const text = String(value || '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function buildManagerRegistrationMessageData(activity, change = {}) {
  const actorName = clip(change.actorName || '\u961f\u5458', 10);
  const isCancelled = change.changeType === 'registration_cancelled';
  const statusText = isCancelled ? '\u9000\u51fa' : '\u52a0\u5165';
  const participantStatusText = isCancelled
    ? '\u53c2\u4e0e\u8005\u9000\u51fa'
    : '\u53c2\u4e0e\u8005\u52a0\u5165';
  const joinedCount = normalizeCount(
    change.joinedCountAfter !== undefined ? change.joinedCountAfter : activity.joinedCount
  );
  const signupLimitTotal = normalizeCount(
    change.signupLimitTotal !== undefined ? change.signupLimitTotal : activity.signupLimitTotal
  );
  const signupResult = signupLimitTotal > 0 ? `${joinedCount}/${signupLimitTotal}` : `${joinedCount}`;

  return {
    thing7: {
      value: clip(activity.title || '\u8db3\u7403\u6d3b\u52a8', 20)
    },
    phrase1: {
      value: participantStatusText
    },
    thing5: {
      value: clip(`${actorName}${statusText}\u62a5\u540d`, 20)
    },
    thing6: {
      value: clip(signupResult, 20)
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

async function loadCollection(db, collectionName, criteria) {
  const items = [];
  let lastId = '';

  while (true) {
    const pageCriteria = lastId
      ? { ...criteria, _id: db.command.gt(lastId) }
      : criteria;
    const result = await db
      .collection(collectionName)
      .where(pageCriteria)
      .orderBy('_id', 'asc')
      .limit(COLLECTION_BATCH_SIZE)
      .get();
    const batch = Array.isArray(result.data) ? result.data : [];
    items.push(...batch);

    if (batch.length < COLLECTION_BATCH_SIZE) {
      return Array.from(
        new Map(items.map((item, index) => [item._id || `__missing_${index}`, item])).values()
      );
    }

    lastId = batch[batch.length - 1] && batch[batch.length - 1]._id;
    if (!lastId) {
      throw new Error(`${collectionName} cursor pagination requires document _id`);
    }
  }
}

async function getAcceptedManagerSubscriptions(db, activity, actorOpenId) {
  const subscriptions = await loadCollection(db, COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS, {
    activityId: activity._id,
    templateKey: TEMPLATE_KEY,
    status: 'accepted'
  });
  const managerSubscriptions = [];

  for (const subscription of subscriptions) {
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

function getSubscriptionDocumentId(subscription) {
  if (subscription && subscription._id) {
    return subscription._id;
  }

  if (
    subscription &&
    subscription.activityId &&
    subscription.userOpenId &&
    subscription.templateKey
  ) {
    return `${subscription.activityId}_${subscription.userOpenId}_${subscription.templateKey}`;
  }

  return '';
}

async function consumeManagerSubscription(db, subscription, stamp, sendStatus, errorMessage) {
  const documentId = getSubscriptionDocumentId(subscription);

  if (!documentId) {
    return;
  }

  const data = {
    status: 'consumed',
    subscribed: false,
    consumedAt: stamp,
    updatedAt: stamp,
    lastSendStatus: sendStatus
  };

  if (errorMessage) {
    data.lastErrorMessage = clip(errorMessage, 200);
  }

  await db
    .collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS)
    .doc(documentId)
    .update({
      data
    })
    .catch(() => null);
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
      await consumeManagerSubscription(db, subscription, payload.stamp, 'sent');
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
      await consumeManagerSubscription(
        db,
        subscription,
        payload.stamp,
        'failed',
        error && error.message ? error.message : String(error)
      );
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
