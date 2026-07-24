const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTION_BATCH_SIZE = 100;
const USER_PROFILE_BATCH_SIZE = COLLECTION_BATCH_SIZE - 1;

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

async function loadCollection(db, command, collectionName, criteria = null) {
  const items = [];
  let lastId = '';

  while (true) {
    const pageCriteria = { ...(criteria || {}) };
    if (lastId) {
      pageCriteria._id = command.gt(lastId);
    }

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

function groupValues(values, size) {
  const groups = [];

  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }

  return groups;
}

async function loadRosterUsers(db, command, registrations) {
  const userOpenIds = Array.from(
    new Set(
      registrations
        .filter(registration => !registration.proxyRegistration)
        .map(registration => registration.userOpenId)
        .filter(Boolean)
    )
  );

  if (userOpenIds.length === 0 || !command || typeof command.in !== 'function') {
    return [];
  }

  const userGroups = groupValues(userOpenIds, USER_PROFILE_BATCH_SIZE);
  const userBatches = await Promise.all(
    userGroups.map(userOpenIds =>
      loadCollection(db, command, COLLECTIONS.USERS, { _id: command.in(userOpenIds) })
    )
  );

  return userBatches.flat();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeAttendanceStatus(value) {
  return value === 'absent' ? 'absent' : 'present';
}

function normalizeActivityType(value) {
  return value === 'external' ? 'external' : 'internal';
}

function formatActivityType(value) {
  return normalizeActivityType(value) === 'external' ? '外战' : '内战';
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

  const participantCompare = String(left.participantName || '').localeCompare(
    String(right.participantName || '')
  );
  if (participantCompare !== 0) {
    return participantCompare;
  }

  return String(left.registrationId || '').localeCompare(String(right.registrationId || ''));
}

function toExportRow(activity, registration, team, user) {
  const proxyRegistration = registration.proxyRegistration === true;

  return {
    activityId: activity._id || '',
    activityTitle: activity.title || '',
    activityType: normalizeActivityType(activity.activityType),
    activityTypeLabel: formatActivityType(activity.activityType),
    teamId: team._id || registration.teamId || '',
    teamName: team.teamName || '',
    registrationId: registration._id || '',
    userOpenId: registration.userOpenId || '',
    participantName: getParticipantName(registration),
    managerAlias: proxyRegistration ? '' : user && user.managerAlias ? user.managerAlias : '',
    preferredPositions: normalizeArray(registration.preferredPositions),
    proxyRegistration,
    attendanceStatus: normalizeAttendanceStatus(registration.attendanceStatus),
    performanceDescription: String(registration.performanceDescription || '').trim(),
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
  const command = deps.command || db.command;

  if (!activityId) {
    throw businessError('activityId is required');
  }

  const [activity, caller, teams, registrations] = await Promise.all([
    loadDoc(db, COLLECTIONS.ACTIVITIES, activityId),
    loadDoc(db, COLLECTIONS.USERS, openid),
    loadCollection(db, command, COLLECTIONS.ACTIVITY_TEAMS, { activityId }),
    loadCollection(db, command, COLLECTIONS.REGISTRATIONS, { activityId, status: 'joined' })
  ]);

  if (!activity) {
    throw businessError('Activity not found');
  }

  if (!canEditActivity(activity, caller, openid)) {
    throw businessError('Only the organizer or an admin can export rosters');
  }

  const users = await loadRosterUsers(db, command, registrations);

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
    .map(registration =>
      toExportRow(activity, registration, teamById[registration.teamId] || {}, userByOpenId[registration.userOpenId])
    )
    .filter(row => row.participantName)
    .sort(compareRows)
    .map(stripInternalSortFields);

  return {
    rows,
    total: rows.length
  };
}

module.exports = { main };
