const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { normalizeActivityType } = require('./validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function getCurrentUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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

  const teamsResult = await db
    .collection(COLLECTIONS.ACTIVITY_TEAMS)
    .where({ activityId })
    .get();

  return {
    sourceActivityId: activityId,
    draft: buildCopyDraft(activity, teamsResult.data || [])
  };
}

module.exports = {
  buildCopyDraft,
  buildReusableTeams,
  getBenchCapacity,
  main
};
