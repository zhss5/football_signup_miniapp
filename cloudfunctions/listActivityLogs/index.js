const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity, hasRole, isAdmin } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

async function loadCollection(db, collectionName) {
  const res = await db.collection(collectionName).get();
  return Array.isArray(res.data) ? res.data : [];
}

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

function normalizeText(value) {
  return String(value || '').trim();
}

function compareLogsByCreatedAtDesc(left, right) {
  const createdCompare = String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  if (createdCompare !== 0) {
    return createdCompare;
  }

  return String(right._id || '').localeCompare(String(left._id || ''));
}

function toSafeLog(log, activityById) {
  const activity = activityById[log.activityId] || {};

  return {
    _id: log._id || '',
    activityId: log.activityId || '',
    activityTitle: activity.title || '',
    action: log.action || '',
    operatorOpenId: log.operatorOpenId || '',
    targetOpenId: log.targetOpenId || log.userOpenId || '',
    registrationId: log.registrationId || '',
    teamId: log.teamId || '',
    fromTeamId: log.fromTeamId || '',
    toTeamId: log.toTeamId || '',
    before: log.before || {},
    after: log.after || {},
    createdAt: log.createdAt || ''
  };
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const activityId = normalizeText(payload.activityId);
  const action = normalizeText(payload.action);
  const targetOpenId = normalizeText(payload.targetOpenId);
  const limit = normalizeLimit(payload.limit);
  const skip = normalizeSkip(payload.skip);

  const [caller, activities, logs] = await Promise.all([
    loadDoc(db, COLLECTIONS.USERS, openid),
    loadCollection(db, COLLECTIONS.ACTIVITIES),
    loadCollection(db, COLLECTIONS.ACTIVITY_LOGS)
  ]);

  const callerIsAdmin = isAdmin(caller);
  const callerIsOrganizer = hasRole(caller, 'organizer');
  if (!callerIsAdmin && !callerIsOrganizer) {
    throw businessError('Only the organizer or an admin can list activity logs');
  }

  const activityById = activities.reduce((acc, activity) => {
    if (activity && activity._id) {
      acc[activity._id] = activity;
    }

    return acc;
  }, {});

  let allowedActivityIds;
  if (activityId) {
    const activity = activityById[activityId] || (await loadDoc(db, COLLECTIONS.ACTIVITIES, activityId));
    if (!activity) {
      throw businessError('Activity not found');
    }

    if (!canEditActivity(activity, caller, openid)) {
      throw businessError('Only the organizer or an admin can list activity logs');
    }

    allowedActivityIds = new Set([activityId]);
    activityById[activityId] = activity;
  } else if (callerIsAdmin) {
    allowedActivityIds = null;
  } else {
    allowedActivityIds = new Set(
      activities
        .filter(activity => activity && activity.organizerOpenId === openid)
        .map(activity => activity._id)
    );
  }

  const filtered = logs
    .filter(log => log && log.activityId)
    .filter(log => !allowedActivityIds || allowedActivityIds.has(log.activityId))
    .filter(log => !action || log.action === action)
    .filter(log => !targetOpenId || log.targetOpenId === targetOpenId || log.userOpenId === targetOpenId)
    .sort(compareLogsByCreatedAtDesc);
  const page = filtered.slice(skip, skip + limit).map(log => toSafeLog(log, activityById));

  return {
    items: page,
    hasMore: skip + limit < filtered.length
  };
}

module.exports = { main };
