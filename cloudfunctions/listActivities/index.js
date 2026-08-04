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

function sortActivitiesByStartDesc(items) {
  return items.slice().sort((left, right) => {
    const startCompare = String(right.startAt || '').localeCompare(String(left.startAt || ''));
    if (startCompare !== 0) {
      return startCompare;
    }

    const createdCompare = String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    if (createdCompare !== 0) {
      return createdCompare;
    }

    return String(right._id || '').localeCompare(String(left._id || ''));
  });
}

function pageActivities(items, event) {
  const skip = normalizeSkip(event.skip);
  const limit = normalizeLimit(event.limit);
  return sortActivitiesByStartDesc(items).slice(skip, skip + limit);
}

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
}

async function loadCollection(db, command, collectionName, criteria = {}) {
  const items = [];
  let lastId = '';

  while (true) {
    const pageCriteria = lastId ? { ...criteria, _id: command.gt(lastId) } : criteria;
    const result = await db
      .collection(collectionName)
      .where(pageCriteria)
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
  const batches = [];

  for (let index = 0; index < uniqueIds.length; index += DOCUMENT_ID_BATCH_SIZE) {
    const idBatch = uniqueIds.slice(index, index + DOCUMENT_ID_BATCH_SIZE);
    const result = await db
      .collection(collectionName)
      .where({ _id: command.in(idBatch) })
      .limit(DOCUMENT_ID_BATCH_SIZE)
      .get();
    batches.push(...(Array.isArray(result.data) ? result.data : []));
  }

  return Array.from(new Map(batches.map(item => [item._id, item])).values());
}

function getUserProfileName(user = {}) {
  return (
    String(user.preferredName || '').trim() ||
    String(user.displayName || '').trim() ||
    String(user.nickName || user.nickname || '').trim()
  );
}

async function enrichActivitiesWithOrganizerProfiles(db, activities) {
  const organizerOpenIds = Array.from(new Set(
    activities.map(activity => String(activity.organizerOpenId || '').trim()).filter(Boolean)
  ));
  const organizerEntries = await Promise.all(
    organizerOpenIds.map(async organizerOpenId => {
      try {
        return [organizerOpenId, await loadUser(db, organizerOpenId)];
      } catch (error) {
        return [organizerOpenId, null];
      }
    })
  );
  const organizersByOpenId = new Map(organizerEntries);

  return activities.map(activity => {
    const organizer = organizersByOpenId.get(activity.organizerOpenId) || {};

    return {
      ...activity,
      organizerName: getUserProfileName(organizer),
      organizerManagerAlias: String(organizer.managerAlias || '').trim()
    };
  });
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

function matchesKeyword(activity, keyword) {
  if (!keyword) {
    return true;
  }

  return [
    activity._id,
    activity.title,
    activity.addressText,
    activity.addressName,
    activity.organizerOpenId
  ]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(keyword));
}

function matchesOrganizerKeyword(activity, keyword) {
  if (!keyword) {
    return true;
  }

  return [
    activity.organizerManagerAlias,
    activity.organizerName,
    activity.organizerPreferredName,
    activity.organizerOpenId
  ]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(keyword));
}

function matchesDateRange(activity, startAtFrom, startAtTo) {
  const startAt = parseTimestamp(activity.startAt);
  const rangeStart = parseTimestamp(startAtFrom);
  const rangeEnd = parseTimestamp(startAtTo);

  if (startAt === null) {
    return false;
  }

  if (rangeStart !== null && startAt < rangeStart) {
    return false;
  }

  if (rangeEnd !== null && startAt > rangeEnd) {
    return false;
  }

  return true;
}

async function listWebAdminActivities(db, command, payload, openid, limit, skip) {
  const caller = await loadUser(db, openid);
  const callerIsAdmin = isAdmin(caller);

  if (!callerIsAdmin && !hasRole(caller, 'organizer')) {
    throw businessError('Only organizers or admins can list web admin activities');
  }

  const activities = await loadCollection(db, command, COLLECTIONS.ACTIVITIES);
  const keyword = String(payload.keyword || '').trim().toLowerCase();
  const status = String(payload.status || '').trim();
  const organizerOpenId = String(payload.organizerOpenId || '').trim();
  const organizerKeyword = String(payload.organizerKeyword || '').trim().toLowerCase();
  const filtered = activities
    .filter(activity => (status ? activity.status === status : activity.status !== 'deleted'))
    .filter(activity => (callerIsAdmin ? true : activity.organizerOpenId === openid))
    .filter(activity =>
      organizerOpenId && callerIsAdmin ? activity.organizerOpenId === organizerOpenId : true
    )
    .filter(activity =>
      matchesDateRange(activity, payload.startAtFrom || payload.startAt, payload.startAtTo || payload.endAt)
    )
    .filter(activity => matchesKeyword(activity, keyword));
  const withOrganizerProfiles = await enrichActivitiesWithOrganizerProfiles(db, filtered);
  const sorted = sortActivitiesByStartDesc(
    withOrganizerProfiles.filter(activity => matchesOrganizerKeyword(activity, organizerKeyword))
  );
  const pageItems = sorted.slice(skip, skip + limit);

  return {
    items: pageItems,
    total: sorted.length,
    limit,
    skip,
    hasMore: sorted.length > skip + limit
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
  const limit = normalizeLimit(payload.limit);
  const skip = normalizeSkip(payload.skip);
  const command = deps.command || db.command;

  if (payload.scope === 'web-admin') {
    return listWebAdminActivities(db, command, payload, openid, limit, skip);
  }

  if (payload.scope === 'home') {
    const res = await db.collection('activities').where({
      status: db.command.in(['published', 'cancelled'])
    }).orderBy('startAt', 'desc').skip(skip).limit(limit).get();
    return { items: res.data };
  }

  if (payload.scope === 'created') {
    const res = await db.collection('activities')
      .where({ organizerOpenId: openid })
      .orderBy('startAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get();
    return { items: res.data };
  }

  if (payload.scope === 'joined') {
    const registrations = await loadCollection(db, command, COLLECTIONS.REGISTRATIONS, {
      userOpenId: openid,
      status: 'joined'
    });
    const activityIds = registrations.map(item => item.activityId).filter(Boolean);
    if (activityIds.length === 0) {
      return { items: [] };
    }

    const activities = await loadDocumentsByIds(
      db,
      command,
      COLLECTIONS.ACTIVITIES,
      activityIds
    );

    return {
      items: pageActivities(activities.filter(item => item.status !== 'deleted'), payload)
    };
  }

  const res = await db.collection('activities')
    .where({ status: payload.status || 'published' })
    .orderBy('startAt', 'desc')
    .skip(skip)
    .limit(limit)
    .get();
  return { items: res.data };
}

module.exports = { main };
