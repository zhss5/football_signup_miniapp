const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity, hasRole, isAdmin } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const COLLECTION_BATCH_SIZE = 100;
const DOCUMENT_ID_BATCH_SIZE = COLLECTION_BATCH_SIZE - 1;

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

async function loadDocs(db, collectionName, ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const docs = await Promise.all(
    uniqueIds.map(id => loadDoc(db, collectionName, id).catch(() => null))
  );
  return docs.filter(Boolean);
}

async function loadCollection(db, command, collectionName, criteria = {}) {
  const items = [];
  let lastId = '';

  while (true) {
    const pageCriteria = lastId ? { ...criteria, _id: command.gt(lastId) } : criteria;
    const res = await db
      .collection(collectionName)
      .where(pageCriteria)
      .orderBy('_id', 'asc')
      .limit(COLLECTION_BATCH_SIZE)
      .get();
    const batch = Array.isArray(res.data) ? res.data : [];
    items.push(...batch);

    if (batch.length < COLLECTION_BATCH_SIZE) {
      return Array.from(new Map(items.map(item => [item._id, item])).values());
    }

    lastId = batch[batch.length - 1] && batch[batch.length - 1]._id;
    if (!lastId) {
      throw new Error(`${collectionName} cursor pagination requires document _id`);
    }
  }
}

function chunkIds(ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const chunks = [];

  for (let index = 0; index < uniqueIds.length; index += DOCUMENT_ID_BATCH_SIZE) {
    chunks.push(uniqueIds.slice(index, index + DOCUMENT_ID_BATCH_SIZE));
  }

  return chunks;
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

async function loadActivityLogs(db, command, filters, allowedActivityIds = null) {
  const baseCriteria = {};
  if (filters.activityId) {
    baseCriteria.activityId = filters.activityId;
  }
  if (filters.action) {
    baseCriteria.action = filters.action;
  }

  let criteriaGroups;
  if (filters.activityId || allowedActivityIds === null) {
    criteriaGroups = [baseCriteria];
  } else {
    criteriaGroups = chunkIds(allowedActivityIds).map(activityIds => ({
      ...baseCriteria,
      activityId: command.in(activityIds)
    }));
  }

  if (criteriaGroups.length === 0) {
    return [];
  }

  if (!filters.targetOpenId) {
    const groups = await Promise.all(
      criteriaGroups.map(criteria =>
        loadCollection(db, command, COLLECTIONS.ACTIVITY_LOGS, criteria)
      )
    );
    return deduplicateLogs(groups);
  }

  const groups = await Promise.all(criteriaGroups.flatMap(criteria => [
    loadCollection(db, command, COLLECTIONS.ACTIVITY_LOGS, {
      ...criteria,
      targetOpenId: filters.targetOpenId
    }),
    loadCollection(db, command, COLLECTIONS.ACTIVITY_LOGS, {
      ...criteria,
      userOpenId: filters.targetOpenId
    })
  ]));

  return deduplicateLogs(groups);
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
  const command = deps.command || db.command;
  const caller = await loadDoc(db, COLLECTIONS.USERS, openid);
  const callerIsAdmin = isAdmin(caller);
  const callerIsOrganizer = hasRole(caller, 'organizer');
  if (!callerIsAdmin && !callerIsOrganizer) {
    throw businessError('Only the organizer or an admin can list activity logs');
  }

  let allowedActivityIds = null;
  let knownActivities = [];

  if (activityId) {
    const activity = await loadDoc(db, COLLECTIONS.ACTIVITIES, activityId);

    if (!activity) {
      throw businessError('Activity not found');
    }

    if (!canEditActivity(activity, caller, openid)) {
      throw businessError('Only the organizer or an admin can list activity logs');
    }
    allowedActivityIds = new Set([activityId]);
    knownActivities = [activity];
  } else if (!callerIsAdmin) {
    knownActivities = await loadCollection(
      db,
      command,
      COLLECTIONS.ACTIVITIES,
      { organizerOpenId: openid }
    );
    allowedActivityIds = new Set(knownActivities.map(activity => activity._id));
  }

  const logs = await loadActivityLogs(
    db,
    command,
    { activityId, action, targetOpenId },
    allowedActivityIds === null ? null : Array.from(allowedActivityIds)
  );

  const filtered = logs
    .filter(log => log && log.activityId)
    .filter(log => !allowedActivityIds || allowedActivityIds.has(log.activityId))
    .filter(log => !action || log.action === action)
    .filter(log => !targetOpenId || log.targetOpenId === targetOpenId || log.userOpenId === targetOpenId)
    .sort(compareLogsByCreatedAtDesc);
  const pageLogs = filtered.slice(skip, skip + limit);
  const knownActivityById = buildCollectionMap(knownActivities);
  const missingActivityIds = pageLogs
    .map(log => log.activityId)
    .filter(id => id && !knownActivityById[id]);
  const [missingActivities, registrations] = await Promise.all([
    loadDocs(db, COLLECTIONS.ACTIVITIES, missingActivityIds),
    loadDocs(db, COLLECTIONS.REGISTRATIONS, pageLogs.map(log => log.registrationId))
  ]);
  const activityById = buildCollectionMap(knownActivities.concat(missingActivities));
  const registrationById = buildCollectionMap(registrations);
  const teams = await loadDocs(db, COLLECTIONS.ACTIVITY_TEAMS, pageLogs.flatMap(log => {
    const registration = registrationById[log.registrationId] || {};
    return [log.teamId, log.fromTeamId, log.toTeamId, registration.teamId];
  }));
  const users = await loadDocs(db, COLLECTIONS.USERS, [
    openid,
    ...registrations.map(registration => registration.userOpenId),
    ...pageLogs.flatMap(log => [log.operatorOpenId, log.targetOpenId, log.userOpenId])
  ]);
  const teamById = buildCollectionMap(teams);
  const userById = buildCollectionMap(users);
  const page = pageLogs.map(log =>
    toSafeLog(log, activityById, registrationById, teamById, userById)
  );

  return {
    items: page,
    hasMore: skip + limit < filtered.length
  };
}

module.exports = { main };
