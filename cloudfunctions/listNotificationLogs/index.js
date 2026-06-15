const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { hasRole, isAdmin } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function normalizeLimit(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function normalizeSkip(value) {
  const skip = Number(value);
  if (!Number.isFinite(skip) || skip <= 0) {
    return 0;
  }

  return Math.floor(skip);
}

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

async function loadCollection(db, collectionName) {
  const res = await db.collection(collectionName).get();
  return Array.isArray(res.data) ? res.data : [];
}

function compareByCreatedAtDesc(left, right) {
  return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
}

function toSafeLog(log) {
  return {
    _id: log._id || '',
    activityId: log.activityId || '',
    notificationType: log.notificationType || log.type || '',
    targetOpenId: log.targetOpenId || log.userOpenId || '',
    status: log.status || '',
    templateId: log.templateId || '',
    errorMessage: log.errorMessage || log.error || '',
    createdAt: log.createdAt || ''
  };
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const openid = await resolveOpenIdFromEvent(
    event,
    context,
    db,
    { ...deps, getWXContext: deps.getWXContext || (() => cloud.getWXContext()) }
  );
  const caller = await loadDoc(db, COLLECTIONS.USERS, openid);
  const callerIsAdmin = isAdmin(caller);

  if (!callerIsAdmin && !hasRole(caller, 'organizer')) {
    throw businessError('Only organizers or admins can list notification logs');
  }

  const activityId = String(payload.activityId || '').trim();
  const notificationType = String(payload.notificationType || '').trim();
  const status = String(payload.status || '').trim();
  const limit = normalizeLimit(payload.limit);
  const skip = normalizeSkip(payload.skip);
  const [activities, logs] = await Promise.all([
    loadCollection(db, COLLECTIONS.ACTIVITIES),
    loadCollection(db, COLLECTIONS.NOTIFICATION_LOGS)
  ]);
  const allowedActivityIds = new Set(
    activities
      .filter(activity => callerIsAdmin || activity.organizerOpenId === openid)
      .map(activity => activity._id)
  );

  if (activityId && !allowedActivityIds.has(activityId)) {
    throw businessError('Only the organizer or an admin can list notification logs');
  }

  const filtered = logs
    .filter(log => (activityId ? log.activityId === activityId : allowedActivityIds.has(log.activityId)))
    .filter(log => (notificationType ? (log.notificationType || log.type) === notificationType : true))
    .filter(log => (status ? log.status === status : true))
    .sort(compareByCreatedAtDesc)
    .map(toSafeLog);

  return {
    items: filtered.slice(skip, skip + limit),
    hasMore: filtered.length > skip + limit
  };
}

module.exports = { main };
