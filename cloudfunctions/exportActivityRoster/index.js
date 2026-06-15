const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

async function loadCollection(db, collectionName) {
  const res = await db.collection(collectionName).get();
  return Array.isArray(res.data) ? res.data : [];
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeAttendanceStatus(value) {
  return value === 'absent' ? 'absent' : 'present';
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

function getTeamSort(team) {
  const sort = Number(team && team.sort);
  return Number.isFinite(sort) ? sort : 0;
}

function compareRows(left, right) {
  if (left.teamSort !== right.teamSort) {
    return left.teamSort - right.teamSort;
  }

  const joinedCompare = String(left.joinedAt || '').localeCompare(String(right.joinedAt || ''));
  if (joinedCompare !== 0) {
    return joinedCompare;
  }

  return String(left.participantName || '').localeCompare(String(right.participantName || ''));
}

function toExportRow(activity, registration, team, user) {
  const proxyRegistration = registration.proxyRegistration === true;

  return {
    activityId: activity._id || '',
    activityTitle: activity.title || '',
    teamId: team._id || registration.teamId || '',
    teamName: team.teamName || '',
    registrationId: registration._id || '',
    userOpenId: registration.userOpenId || '',
    participantName: getParticipantName(registration),
    managerAlias: proxyRegistration ? '' : user && user.managerAlias ? user.managerAlias : '',
    preferredPositions: normalizeArray(registration.preferredPositions),
    proxyRegistration,
    attendanceStatus: normalizeAttendanceStatus(registration.attendanceStatus),
    teamSort: getTeamSort(team),
    joinedAt: registration.joinedAt || ''
  };
}

function stripInternalSortFields(row) {
  const { teamSort, joinedAt, ...publicRow } = row;
  return publicRow;
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
  const activityId = String(payload.activityId || '').trim();

  if (!activityId) {
    throw businessError('activityId is required');
  }

  const [activity, caller, teams, registrations, users] = await Promise.all([
    loadDoc(db, COLLECTIONS.ACTIVITIES, activityId),
    loadDoc(db, COLLECTIONS.USERS, openid),
    loadCollection(db, COLLECTIONS.ACTIVITY_TEAMS),
    loadCollection(db, COLLECTIONS.REGISTRATIONS),
    loadCollection(db, COLLECTIONS.USERS)
  ]);

  if (!activity) {
    throw businessError('Activity not found');
  }

  if (!canEditActivity(activity, caller, openid)) {
    throw businessError('Only the organizer or an admin can export rosters');
  }

  const teamById = teams.reduce((acc, team) => {
    if (team && team.activityId === activityId) {
      acc[team._id] = team;
    }

    return acc;
  }, {});
  const userByOpenId = users.reduce((acc, user) => {
    if (user && user._id) {
      acc[user._id] = user;
    }

    return acc;
  }, {});
  const rows = registrations
    .filter(registration => registration.activityId === activityId && registration.status === 'joined')
    .map(registration =>
      toExportRow(activity, registration, teamById[registration.teamId] || {}, userByOpenId[registration.userOpenId])
    )
    .filter(row => row.participantName)
    .sort(compareRows)
    .map(stripInternalSortFields);

  return { rows };
}

module.exports = { main };
