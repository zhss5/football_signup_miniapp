const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { hasRole, isAdmin } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const COLLECTION_BATCH_SIZE = 100;
const DOCUMENT_ID_BATCH_SIZE = COLLECTION_BATCH_SIZE - 1;

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

async function loadCollection(db, command, collectionName, criteria = {}) {
  const items = [];
  let lastId = '';

  while (true) {
    const query = lastId ? { ...criteria, _id: command.gt(lastId) } : criteria;
    const result = await db
      .collection(collectionName)
      .where(query)
      .orderBy('_id', 'asc')
      .limit(COLLECTION_BATCH_SIZE)
      .get();
    const batch = Array.isArray(result.data) ? result.data : [];
    items.push(...batch);

    if (batch.length < COLLECTION_BATCH_SIZE) {
      return Array.from(new Map(items.map(item => [item._id, item])).values());
    }

    lastId = batch[batch.length - 1]._id;
    if (!lastId) {
      throw new Error(`${collectionName} cursor pagination requires document _id`);
    }
  }
}

async function loadDocumentsByIds(db, command, collectionName, ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const items = [];

  for (let index = 0; index < uniqueIds.length; index += DOCUMENT_ID_BATCH_SIZE) {
    const idBatch = uniqueIds.slice(index, index + DOCUMENT_ID_BATCH_SIZE);
    const result = await db
      .collection(collectionName)
      .where({ _id: command.in(idBatch) })
      .limit(DOCUMENT_ID_BATCH_SIZE)
      .get();
    items.push(...(Array.isArray(result.data) ? result.data : []));
  }

  return Array.from(new Map(items.map(item => [item._id, item])).values());
}

function chunkIds(ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const chunks = [];

  for (let index = 0; index < uniqueIds.length; index += DOCUMENT_ID_BATCH_SIZE) {
    chunks.push(uniqueIds.slice(index, index + DOCUMENT_ID_BATCH_SIZE));
  }

  return chunks;
}

function deduplicateLogs(groups) {
  return Array.from(new Map(groups.flat().map(log => [log._id, log])).values());
}

async function loadNotificationLogs(db, command, filters, allowedActivityIds = null) {
  const baseCriteria = {
    ...(filters.activityId ? { activityId: filters.activityId } : {}),
    ...(filters.status ? { status: filters.status } : {})
  };
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

  if (!filters.notificationType) {
    return deduplicateLogs(await Promise.all(
      criteriaGroups.map(criteria =>
        loadCollection(db, command, COLLECTIONS.NOTIFICATION_LOGS, criteria)
      )
    ));
  }

  return deduplicateLogs(await Promise.all(criteriaGroups.flatMap(criteria => [
    loadCollection(db, command, COLLECTIONS.NOTIFICATION_LOGS, {
      ...criteria,
      notificationType: filters.notificationType
    }),
    loadCollection(db, command, COLLECTIONS.NOTIFICATION_LOGS, {
      ...criteria,
      type: filters.notificationType
    })
  ])));
}

function compareByCreatedAtDesc(left, right) {
  const createdAtCompare = String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  if (createdAtCompare !== 0) {
    return createdAtCompare;
  }

  return String(right._id || '').localeCompare(String(left._id || ''));
}

function toSafeLog(log, activity) {
  return {
    _id: log._id || '',
    activityId: log.activityId || '',
    activityTitle: (activity && activity.title) || '',
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
  const command = deps.command || db.command;
  let knownActivities = [];
  let allowedActivityIds = null;

  if (activityId) {
    const activity = await loadDoc(db, COLLECTIONS.ACTIVITIES, activityId);
    if (!activity || (!callerIsAdmin && activity.organizerOpenId !== openid)) {
      throw businessError('Only the organizer or an admin can list notification logs');
    }
    knownActivities = [activity];
    allowedActivityIds = new Set([activityId]);
  } else if (!callerIsAdmin) {
    knownActivities = await loadCollection(
      db,
      command,
      COLLECTIONS.ACTIVITIES,
      { organizerOpenId: openid }
    );
    allowedActivityIds = new Set(knownActivities.map(activity => activity._id));
  }

  const logs = await loadNotificationLogs(
    db,
    command,
    { activityId, notificationType, status },
    allowedActivityIds === null ? null : Array.from(allowedActivityIds)
  );

  const filtered = logs
    .filter(log => !allowedActivityIds || allowedActivityIds.has(log.activityId))
    .filter(log => (notificationType ? (log.notificationType || log.type) === notificationType : true))
    .filter(log => (status ? log.status === status : true))
    .sort(compareByCreatedAtDesc);
  const pageLogs = filtered.slice(skip, skip + limit);
  const knownActivityById = new Map(
    knownActivities.map(activity => [activity._id, activity])
  );
  const missingActivities = await loadDocumentsByIds(
    db,
    command,
    COLLECTIONS.ACTIVITIES,
    pageLogs
      .map(log => log.activityId)
      .filter(id => id && !knownActivityById.has(id))
  );
  const activityById = new Map(
    knownActivities.concat(missingActivities).map(activity => [activity._id, activity])
  );

  return {
    items: pageLogs.map(log => toSafeLog(log, activityById.get(log.activityId))),
    total: filtered.length,
    limit,
    skip,
    hasMore: skip + limit < filtered.length
  };
}

module.exports = { main };
