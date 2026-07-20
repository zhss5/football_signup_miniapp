const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { hasRole, isAdmin } = require('./roles');
const { normalizeActivityType } = require('./validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
}

async function loadCollection(db, collectionName) {
  const res = await db.collection(collectionName).get();
  return Array.isArray(res.data) ? res.data : [];
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
    details: []
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
  const nowAt = getNowTimestamp(deps);
  const [activities, registrations, users] = await Promise.all([
    loadCollection(db, COLLECTIONS.ACTIVITIES),
    loadCollection(db, COLLECTIONS.REGISTRATIONS),
    loadCollection(db, COLLECTIONS.USERS)
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

  const items = Object.values(statsByName)
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
      attendanceRate: toAttendanceRate(row.presentCount, row.signupCount),
      cancelRate: toRate(
        row.cancelledActivityCount,
        row.effectiveSignupActivityCount + row.cancelledActivityCount
      )
    }))
    .sort((left, right) => left.participantName.localeCompare(right.participantName));

  return { items };
}

module.exports = { main };
