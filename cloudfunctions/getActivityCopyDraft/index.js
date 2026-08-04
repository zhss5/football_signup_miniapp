const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { normalizeActivityType } = require('./validators');

const DEFAULT_LATE_CANCELLATION_NOTICE_WINDOW_HOURS = 6;
const MAX_LATE_CANCELLATION_NOTICE_WINDOW_HOURS = 168;
const COLLECTION_BATCH_SIZE = 100;

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function getCurrentUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

async function loadActivityTeams(db, activityId) {
  const teams = [];
  const seenIds = new Set();
  let lastId = '';

  while (true) {
    const criteria = lastId
      ? { activityId, _id: db.command.gt(lastId) }
      : { activityId };
    const result = await db
      .collection(COLLECTIONS.ACTIVITY_TEAMS)
      .where(criteria)
      .orderBy('_id', 'asc')
      .limit(COLLECTION_BATCH_SIZE)
      .get();
    const batch = Array.isArray(result.data) ? result.data : [];

    batch.forEach(team => {
      if (team && team._id && !seenIds.has(team._id)) {
        seenIds.add(team._id);
        teams.push(team);
      }
    });

    if (batch.length < COLLECTION_BATCH_SIZE) {
      return teams;
    }

    lastId = batch[batch.length - 1] && batch[batch.length - 1]._id;
    if (!lastId) {
      throw new Error('activity_teams cursor pagination requires document _id');
    }
  }
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeLateCancellationNoticeWindowHours(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return DEFAULT_LATE_CANCELLATION_NOTICE_WINDOW_HOURS;
  }

  const hours = Number(value);
  return Number.isInteger(hours) && hours >= 0 && hours <= MAX_LATE_CANCELLATION_NOTICE_WINDOW_HOURS
    ? hours
    : DEFAULT_LATE_CANCELLATION_NOTICE_WINDOW_HOURS;
}

function buildReusableTeams(teams = []) {
  return teams
    .filter(team => team && team.status !== 'inactive' && team.teamType !== 'bench')
    .sort((left, right) => Number(left.sort || 0) - Number(right.sort || 0))
    .map((team, index) => ({
      teamName: normalizeString(team.teamName),
      maxMembers: Number(team.maxMembers) || 0,
      colorKey: normalizeString(team.colorKey) || ['green', 'red', 'blue'][index] || 'green'
    }));
}

function getBenchCapacity(teams = []) {
  const benchTeam = teams.find(
    team => team && team.status !== 'inactive' && team.teamType === 'bench'
  );

  return benchTeam ? Math.max(Number(benchTeam.maxMembers) || 0, 0) : 0;
}

function buildCopyDraft(activity, teams) {
  const imageList = normalizeArray(activity.imageList);
  const detailImages = normalizeArray(activity.detailImages);

  return {
    title: normalizeString(activity.title),
    activityType: normalizeActivityType(activity.activityType),
    startAt: '',
    endAt: '',
    signupDeadlineAt: '',
    sourceStartAt: normalizeString(activity.startAt),
    sourceEndAt: normalizeString(activity.endAt),
    sourceSignupDeadlineAt: normalizeString(activity.signupDeadlineAt),
    addressText: normalizeString(activity.addressText),
    addressName: normalizeString(activity.addressName || activity.addressText),
    location: activity.location || null,
    description: String(activity.description || ''),
    insuranceLink: normalizeString(activity.insuranceLink),
    notificationHint: normalizeString(activity.notificationHint),
    lateCancellationNoticeWindowHours: normalizeLateCancellationNoticeWindowHours(
      activity.lateCancellationNoticeWindowHours
    ),
    registrationNoticeThreshold: Number(activity.registrationNoticeThreshold) || 0,
    coverImage: imageList[0] || activity.coverImage || '',
    coverThumbImage: activity.coverThumbImage || '',
    shareImage: activity.shareImage || '',
    imageList: imageList.length ? imageList : normalizeArray([activity.coverImage]),
    detailImages,
    benchCapacity: getBenchCapacity(teams),
    signupLimitTotal: Number(activity.signupLimitTotal) || 0,
    inviteCode: '',
    status: 'draft',
    confirmStatus: 'pending',
    requiresTimeReview: true,
    teams: buildReusableTeams(teams)
  };
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const activityId = normalizeString(event.activityId);

  if (!activityId) {
    throw businessError('activityId is required');
  }

  const db = deps.db || cloud.database();
  const openid = await resolveOpenIdFromEvent(
    event,
    context,
    db,
    { ...deps, getWXContext: deps.getWXContext || (() => cloud.getWXContext()) }
  );
  const activityResult = await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).get();
  const activity = activityResult.data;

  if (!activity) {
    throw businessError('Activity not found');
  }

  if (activity.status === 'deleted') {
    throw businessError('Deleted activities cannot be copied');
  }

  const user = await getCurrentUser(db, openid);
  if (!canEditActivity(activity, user, openid)) {
    throw businessError('Only the organizer or an admin can copy this activity');
  }

  const teams = await loadActivityTeams(db, activityId);

  return {
    sourceActivityId: activityId,
    draft: buildCopyDraft(activity, teams)
  };
}

module.exports = {
  buildCopyDraft,
  buildReusableTeams,
  getBenchCapacity,
  main
};
