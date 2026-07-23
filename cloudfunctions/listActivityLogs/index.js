const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity, hasRole, isAdmin } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const COLLECTION_BATCH_SIZE = 100;

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

async function loadCollection(db, collectionName, criteria = null) {
  const items = [];
  let offset = 0;

  while (true) {
    let query = db.collection(collectionName);
    if (criteria && Object.keys(criteria).length) {
      query = query.where(criteria);
    }

    const res = await query.skip(offset).limit(COLLECTION_BATCH_SIZE).get();
    const batch = Array.isArray(res.data) ? res.data : [];
    items.push(...batch);

    if (batch.length < COLLECTION_BATCH_SIZE) {
      return items;
    }

    offset += batch.length;
  }
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

function buildCollectionMap(items) {
  return items.reduce((acc, item) => {
    if (item && item._id) {
      acc[item._id] = item;
    }

    return acc;
  }, {});
}

function pickText(...values) {
  const value = values.find(item => String(item || '').trim());
  return value ? String(value).trim() : '';
}

function getUserDisplayName(user) {
  return pickText(
    user && user.preferredName,
    user && user.displayName,
    user && user.nickName,
    user && user.nickname
  );
}

function getUserManagerAlias(user) {
  return normalizeText(user && user.managerAlias);
}

function deduplicateLogs(logGroups) {
  const logsById = new Map();

  logGroups.flat().forEach(log => {
    if (!log) {
      return;
    }

    const key = log._id || [
      log.activityId,
      log.action,
      log.registrationId,
      log.createdAt
    ].join(':');
    logsById.set(key, log);
  });

  return Array.from(logsById.values());
}

async function loadActivityLogs(db, filters) {
  const criteria = {};
  if (filters.activityId) {
    criteria.activityId = filters.activityId;
  }
  if (filters.action) {
    criteria.action = filters.action;
  }

  if (!filters.targetOpenId) {
    return loadCollection(db, COLLECTIONS.ACTIVITY_LOGS, criteria);
  }

  const [currentLogs, legacyLogs] = await Promise.all([
    loadCollection(db, COLLECTIONS.ACTIVITY_LOGS, {
      ...criteria,
      targetOpenId: filters.targetOpenId
    }),
    loadCollection(db, COLLECTIONS.ACTIVITY_LOGS, {
      ...criteria,
      userOpenId: filters.targetOpenId
    })
  ]);

  return deduplicateLogs([currentLogs, legacyLogs]);
}

function toSafeLog(log, activityById, registrationById, teamById, userById) {
  const activity = activityById[log.activityId] || {};
  const registration = registrationById[log.registrationId] || {};
  const teamId = pickText(log.teamId, registration.teamId);
  const fromTeamId = log.fromTeamId || '';
  const toTeamId = log.toTeamId || '';
  const targetOpenId = log.targetOpenId || log.userOpenId || registration.userOpenId || '';
  const operatorOpenId = log.operatorOpenId || '';
  const targetUser = userById[targetOpenId] || {};
  const operatorUser = userById[operatorOpenId] || {};

  return {
    _id: log._id || '',
    activityId: log.activityId || '',
    activityTitle: activity.title || '',
    action: log.action || '',
    operatorOpenId,
    operatorName: getUserDisplayName(operatorUser),
    operatorManagerAlias: getUserManagerAlias(operatorUser),
    targetOpenId,
    targetName: pickText(
      log.after && log.after.signupName,
      registration.signupName,
      getUserDisplayName(targetUser),
      targetOpenId
    ),
    targetManagerAlias: getUserManagerAlias(targetUser),
    registrationId: log.registrationId || '',
    teamId,
    teamName: teamById[teamId] ? teamById[teamId].teamName || '' : '',
    fromTeamId,
    fromTeamName: teamById[fromTeamId] ? teamById[fromTeamId].teamName || '' : '',
    toTeamId,
    toTeamName: teamById[toTeamId] ? teamById[toTeamId].teamName || '' : '',
    before: log.before || {},
    after: log.after || {},
    attendanceStatus: log.attendanceStatus || (log.after && log.after.attendanceStatus) || '',
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
  const activityId = normalizeText(payload.activityId);
  const action = normalizeText(payload.action);
  const targetOpenId = normalizeText(payload.targetOpenId);
  const limit = normalizeLimit(payload.limit);
  const skip = normalizeSkip(payload.skip);

  const [caller, activities, logs, registrations, teams, users] = await Promise.all([
    loadDoc(db, COLLECTIONS.USERS, openid),
    loadCollection(db, COLLECTIONS.ACTIVITIES),
    loadActivityLogs(db, { activityId, action, targetOpenId }),
    loadCollection(db, COLLECTIONS.REGISTRATIONS),
    loadCollection(db, COLLECTIONS.ACTIVITY_TEAMS),
    loadCollection(db, COLLECTIONS.USERS)
  ]);

  const callerIsAdmin = isAdmin(caller);
  const callerIsOrganizer = hasRole(caller, 'organizer');
  if (!callerIsAdmin && !callerIsOrganizer) {
    throw businessError('Only the organizer or an admin can list activity logs');
  }

  const activityById = buildCollectionMap(activities);
  const registrationById = buildCollectionMap(registrations);
  const teamById = buildCollectionMap(teams);
  const userById = buildCollectionMap(users);

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
  const page = filtered
    .slice(skip, skip + limit)
    .map(log => toSafeLog(log, activityById, registrationById, teamById, userById));

  return {
    items: page,
    hasMore: skip + limit < filtered.length
  };
}

module.exports = { main };
