const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { hasRole, isAdmin } = require('./roles');

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

function isConfirmedActivityInRange(activity, rangeStart, rangeEnd) {
  if (!activity || activity.confirmStatus !== 'confirmed') {
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

  return true;
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

function normalizeAttendanceStatus(value) {
  return value === 'absent' ? 'absent' : 'present';
}

function toAttendanceRate(presentCount, signupCount) {
  if (signupCount <= 0) {
    return 0;
  }

  return Number((presentCount / signupCount).toFixed(4));
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const caller = await loadUser(db, openid);
  const callerIsAdmin = isAdmin(caller);

  if (!callerIsAdmin && !hasRole(caller, 'organizer')) {
    throw businessError('Only organizers or admins can view attendance stats');
  }

  const rangeStart = parseTimestamp(payload.startAt);
  const rangeEnd = parseTimestamp(payload.endAt);
  const [activities, registrations] = await Promise.all([
    loadCollection(db, COLLECTIONS.ACTIVITIES),
    loadCollection(db, COLLECTIONS.REGISTRATIONS)
  ]);
  const activityById = activities.reduce((acc, activity) => {
    if (
      isConfirmedActivityInRange(activity, rangeStart, rangeEnd) &&
      (callerIsAdmin || activity.organizerOpenId === openid)
    ) {
      acc[activity._id] = activity;
    }

    return acc;
  }, {});
  const statsByName = registrations.reduce((acc, registration) => {
    if (!activityById[registration.activityId] || registration.status !== 'joined') {
      return acc;
    }

    const participantName = getParticipantName(registration);
    if (!participantName) {
      return acc;
    }

    if (!acc[participantName]) {
      acc[participantName] = {
        participantName,
        signupCount: 0,
        presentCount: 0,
        absentCount: 0
      };
    }

    const row = acc[participantName];
    row.signupCount += 1;

    if (normalizeAttendanceStatus(registration.attendanceStatus) === 'absent') {
      row.absentCount += 1;
    } else {
      row.presentCount += 1;
    }

    return acc;
  }, {});

  const items = Object.values(statsByName)
    .map(row => ({
      ...row,
      attendanceRate: toAttendanceRate(row.presentCount, row.signupCount)
    }))
    .sort((left, right) => left.participantName.localeCompare(right.participantName));

  return { items };
}

module.exports = { main };
