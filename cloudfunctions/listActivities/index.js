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

function sortActivitiesByStartDesc(items) {
  return items.slice().sort((left, right) => {
    const startCompare = String(right.startAt || '').localeCompare(String(left.startAt || ''));
    if (startCompare !== 0) {
      return startCompare;
    }

    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
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

async function listWebAdminActivities(db, payload, openid, limit, skip) {
  const caller = await loadUser(db, openid);
  const callerIsAdmin = isAdmin(caller);

  if (!callerIsAdmin && !hasRole(caller, 'organizer')) {
    throw businessError('Only organizers or admins can list web admin activities');
  }

  const res = await db.collection(COLLECTIONS.ACTIVITIES).get();
  const keyword = String(payload.keyword || '').trim().toLowerCase();
  const status = String(payload.status || '').trim();
  const organizerOpenId = String(payload.organizerOpenId || '').trim();
  const filtered = (Array.isArray(res.data) ? res.data : [])
    .filter(activity => (status ? activity.status === status : activity.status !== 'deleted'))
    .filter(activity => (callerIsAdmin ? true : activity.organizerOpenId === openid))
    .filter(activity =>
      organizerOpenId && callerIsAdmin ? activity.organizerOpenId === organizerOpenId : true
    )
    .filter(activity =>
      matchesDateRange(activity, payload.startAtFrom || payload.startAt, payload.startAtTo || payload.endAt)
    )
    .filter(activity => matchesKeyword(activity, keyword));
  const sorted = sortActivitiesByStartDesc(filtered);
  const pageItems = sorted.slice(skip, skip + limit);

  return {
    items: await enrichActivitiesWithOrganizerProfiles(db, pageItems),
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

  if (payload.scope === 'web-admin') {
    return listWebAdminActivities(db, payload, openid, limit, skip);
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
    const regRes = await db.collection('registrations').where({ userOpenId: openid, status: 'joined' }).get();
    const activityIds = regRes.data.map(item => item.activityId);
    if (activityIds.length === 0) {
      return { items: [] };
    }

    const activityRes = await db.collection('activities').where({
      _id: db.command.in(activityIds)
    }).get();

    return {
      items: pageActivities(activityRes.data.filter(item => item.status !== 'deleted'), payload)
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
