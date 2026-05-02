const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { ensureCloudCollections } = require('./database');
const { businessError } = require('./errors');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const NOTIFICATION_COLLECTIONS = [COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS];
let collectionBootstrapPromise = null;

function normalizeStatus(value) {
  return value === 'accept' || value === 'accepted' ? 'accepted' : 'declined';
}

function normalizeTemplateKey(value) {
  return String(value || 'activity_notice').trim() || 'activity_notice';
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

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (!event.activityId) {
    throw businessError('activityId is required');
  }

  if (!event.templateId) {
    throw businessError('templateId is required');
  }

  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const templateKey = normalizeTemplateKey(event.templateKey);
  const status = normalizeStatus(event.status);
  const stamp = nowIso(deps.now);
  const documentId = `${event.activityId}_${openid}_${templateKey}`;

  await ensureNotificationCollections(db, deps);

  await db.collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS).doc(documentId).set({
    data: {
      activityId: event.activityId,
      userOpenId: openid,
      templateKey,
      templateId: String(event.templateId).trim(),
      status,
      subscribed: status === 'accepted',
      updatedAt: stamp
    }
  });

  return {
    activityId: event.activityId,
    templateKey,
    status,
    subscribed: status === 'accepted'
  };
}

module.exports = { ensureNotificationCollections, main };
