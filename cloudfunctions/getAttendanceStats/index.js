const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { hasRole, isAdmin } = require('./roles');
const { normalizeActivityType } = require('./validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const COLLECTION_BATCH_SIZE = 100;

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
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

function parseTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getNowTimestamp(deps = {}) {
  const injected = parseTimestamp(deps.now);
  return injected === null ? Date.now() : injected;
}

function normalizeActivityTypeFilter(value) {
  const type = String(value || '').trim();

  if (!type || type === 'all') {
    return 'all';
  }

  return normalizeActivityType(type);
}

function normalizeStatisticsType(value) {
  const type = String(value || '').trim();
  return type === 'attendance' || type === 'cancellation' || type === 'both' ? type : 'all';
}

function paginateItems(items, limit, skip) {
  const total = items.length;
  return {
    items: items.slice(skip, skip + limit),
    total,
    limit,
    skip,
    hasMore: skip + limit < total
  };
}

function matchesActivityType(activity, activityTypeFilter) {
  if (activityTypeFilter === 'all') {
    return true;
  }

  return normalizeActivityType(activity.activityType) === activityTypeFilter;
}

function isBaseActivityInRange(activity, rangeStart, rangeEnd, activityTypeFilter) {
  if (!activity) {
    return false;
  }

  if (activity.status === 'cancelled' || activity.status === 'deleted') {
    return false;
  }

  const startAt = parseTimestamp(activity.startAt);
  if (startAt === null) {
    return false;
  }

  if (rangeStart !== null && startAt < rangeStart) {
    return false;
  }

  if (rangeEnd !== null && startAt > rangeEnd) {
    return false;
  }

  if (!matchesActivityType(activity, activityTypeFilter)) {
    return false;
  }

  return true;
}

function isCountableActivityInRange(activity, rangeStart, rangeEnd, nowAt, activityTypeFilter) {
  if (!isBaseActivityInRange(activity, rangeStart, rangeEnd, activityTypeFilter)) {
    return false;
  }

  const startAt = parseTimestamp(activity.startAt);
  return startAt <= nowAt;
}

function getParticipantName(registration) {
  return String(
    registration.signupName ||
      registration.displayName ||
      registration.preferredName ||
      registration.userOpenId ||
      ''
  ).trim();
}

function getParticipantStatsKey(registration, participantName) {
  if (registration && registration.proxyRegistration === true) {
    return `proxy-name:${participantName}`;
  }

  const userOpenId = String(registration && registration.userOpenId ? registration.userOpenId : '').trim();
  return userOpenId ? `user-openid:${userOpenId}` : `name:${participantName}`;
}

function getManagerAlias(registration, userById) {
  if (!registration || registration.proxyRegistration) {
    return '';
  }

  const user = userById[registration.userOpenId] || {};
  return String(registration.managerAlias || user.managerAlias || '').trim();
}

function normalizeAttendanceStatus(value) {
  return value === 'absent' ? 'absent' : 'present';
}

function toAttendanceRate(presentCount, signupCount) {
  if (signupCount <= 0) {
    return 0;
  }

  return Number((presentCount / signupCount).toFixed(4));
}

function toRate(numerator, denominator) {
  if (denominator <= 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

function createStatsRow(participantName) {
  return {
    participantName,
    managerAlias: '',
    signupCount: 0,
    presentCount: 0,
    absentCount: 0,
    effectiveSignupActivityCount: 0,
    cancelledActivityCount: 0,
    details: [],
    cancellationDetails: []
  };
}

function getOrCreateStatsRow(acc, key, participantName) {
  if (!acc[key]) {
    acc[key] = createStatsRow(participantName);
  }

  return acc[key];
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
  const caller = await loadUser(db, openid);
  const callerIsAdmin = isAdmin(caller);

  if (!callerIsAdmin && !hasRole(caller, 'organizer')) {
    throw businessError('Only organizers or admins can view attendance stats');
  }

  const rangeStart = parseTimestamp(payload.startAt);
  const rangeEnd = parseTimestamp(payload.endAt);
  const activityTypeFilter = normalizeActivityTypeFilter(payload.activityType);
  const statisticsType = normalizeStatisticsType(payload.statisticsType);
  const nowAt = getNowTimestamp(deps);
  const limit = normalizeLimit(payload.limit);
  const skip = normalizeSkip(payload.skip);
  const command = deps.command || db.command;
  const [activities, registrations, users] = await Promise.all([
    loadCollection(db, command, COLLECTIONS.ACTIVITIES),
    loadCollection(db, command, COLLECTIONS.REGISTRATIONS),
    loadCollection(db, command, COLLECTIONS.USERS)
  ]);
  const userById = users.reduce((acc, user) => {
    if (user && user._id) {
      acc[user._id] = user;
    }

    return acc;
  }, {});
  const activityById = activities.reduce((acc, activity) => {
    if (
      isCountableActivityInRange(activity, rangeStart, rangeEnd, nowAt, activityTypeFilter) &&
      (callerIsAdmin || activity.organizerOpenId === openid)
    ) {
      acc[activity._id] = activity;
    }

    return acc;
  }, {});
  const outcomeActivityById = activities.reduce((acc, activity) => {
    if (
      isBaseActivityInRange(activity, rangeStart, rangeEnd, activityTypeFilter) &&
      (callerIsAdmin || activity.organizerOpenId === openid)
    ) {
      acc[activity._id] = activity;
    }

    return acc;
  }, {});
  const statsByName = {};
  const outcomeByParticipantActivity = registrations.reduce((acc, registration) => {
    const activity = outcomeActivityById[registration.activityId];
    if (!activity || (registration.status !== 'joined' && registration.status !== 'cancelled')) {
      return acc;
    }

    const participantName = getParticipantName(registration);
    if (!participantName) {
      return acc;
    }

    const participantStatsKey = getParticipantStatsKey(registration, participantName);
    const outcomeKey = `${participantStatsKey}:${registration.activityId}`;
    const previous = acc[outcomeKey];
    const outcome = registration.status === 'joined' ? 'joined' : 'cancelled';

    if (!previous || previous.outcome !== 'joined') {
      acc[outcomeKey] = {
        participantStatsKey,
        participantName,
        activity,
        registration,
        outcome
      };
    }

    return acc;
  }, {});

  Object.values(outcomeByParticipantActivity).forEach(item => {
    const row = getOrCreateStatsRow(statsByName, item.participantStatsKey, item.participantName);
    const managerAlias = getManagerAlias(item.registration, userById);

    if (!row.managerAlias && managerAlias) {
      row.managerAlias = managerAlias;
    }

    row.cancellationDetails.push({
      activityId: item.activity._id || item.registration.activityId || '',
      activityTitle: item.activity.title || '',
      activityType: normalizeActivityType(item.activity.activityType),
      startAt: item.activity.startAt || '',
      registrationId: item.registration._id || '',
      signupName: item.registration.signupName || item.participantName,
      managerAlias,
      outcome: item.outcome,
      cancelledAt: item.outcome === 'cancelled' ? String(item.registration.cancelledAt || '') : ''
    });

    if (item.outcome === 'joined') {
      row.effectiveSignupActivityCount += 1;
      return;
    }

    row.cancelledActivityCount += 1;
  });

  registrations.reduce((acc, registration) => {
    if (!activityById[registration.activityId] || registration.status !== 'joined') {
      return acc;
    }

    const participantName = getParticipantName(registration);
    if (!participantName) {
      return acc;
    }

    const participantStatsKey = getParticipantStatsKey(registration, participantName);
    const row = getOrCreateStatsRow(acc, participantStatsKey, participantName);
    const managerAlias = getManagerAlias(registration, userById);
    const activity = activityById[registration.activityId];
    const attendanceStatus = normalizeAttendanceStatus(registration.attendanceStatus);
    row.signupCount += 1;
    if (!row.managerAlias && managerAlias) {
      row.managerAlias = managerAlias;
    }

    row.details.push({
      activityId: activity._id || registration.activityId || '',
      activityTitle: activity.title || '',
      activityType: normalizeActivityType(activity.activityType),
      startAt: activity.startAt || '',
      teamName: registration.teamName || '',
      signupName: registration.signupName || participantName,
      managerAlias,
      attendanceStatus
    });

    if (attendanceStatus === 'absent') {
      row.absentCount += 1;
    } else {
      row.presentCount += 1;
    }

    return acc;
  }, statsByName);

  const combinedItems = Object.values(statsByName)
    .filter(row => row.signupCount > 0 || row.cancelledActivityCount > 0)
    .map(row => ({
      ...row,
      details: row.details.sort((left, right) => {
        const leftTime = parseTimestamp(left.startAt) || 0;
        const rightTime = parseTimestamp(right.startAt) || 0;
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }

        return String(left.activityTitle || '').localeCompare(String(right.activityTitle || ''));
      }),
      cancellationDetails: row.cancellationDetails.sort((left, right) => {
        const leftTime = parseTimestamp(left.startAt) || 0;
        const rightTime = parseTimestamp(right.startAt) || 0;
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }

        const titleOrder = String(left.activityTitle || '').localeCompare(
          String(right.activityTitle || '')
        );
        if (titleOrder !== 0) {
          return titleOrder;
        }

        return String(left.registrationId || '').localeCompare(String(right.registrationId || ''));
      }),
      attendanceRate: toAttendanceRate(row.presentCount, row.signupCount),
      cancelRate: toRate(
        row.cancelledActivityCount,
        row.effectiveSignupActivityCount + row.cancelledActivityCount
      )
    }))
    .sort((left, right) => left.participantName.localeCompare(right.participantName));
  const attendanceItems = combinedItems.filter(row => row.signupCount > 0);
  const cancellationItems = combinedItems.filter(
    row => row.effectiveSignupActivityCount + row.cancelledActivityCount > 0
  );

  if (statisticsType === 'both') {
    return {
      projections: {
        attendance: paginateItems(attendanceItems, limit, skip),
        cancellation: paginateItems(cancellationItems, limit, skip)
      }
    };
  }

  if (statisticsType === 'attendance') {
    return paginateItems(attendanceItems, limit, skip);
  }

  if (statisticsType === 'cancellation') {
    return paginateItems(cancellationItems, limit, skip);
  }

  return paginateItems(combinedItems, limit, skip);
}

module.exports = { main };
