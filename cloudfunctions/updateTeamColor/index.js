const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { isTeamColorKey } = require('./team-colors');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function getCurrentUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const activityId = String(event.activityId || '').trim();
  const teamId = String(event.teamId || '').trim();
  const colorKey = String(event.colorKey || '').trim();

  if (!activityId) {
    throw businessError('activityId is required');
  }

  if (!teamId) {
    throw businessError('teamId is required');
  }

  if (!isTeamColorKey(colorKey)) {
    throw businessError('Unsupported team color');
  }

  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const activityRes = await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).get();
  const activity = activityRes.data;

  if (!activity) {
    throw businessError('Activity not found');
  }

  const user = await getCurrentUser(db, openid);
  if (!canEditActivity(activity, user, openid)) {
    throw businessError('Only the organizer or an admin can update team colors');
  }

  const teamRes = await db.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(teamId).get();
  const team = teamRes.data;

  if (!team || team.activityId !== activityId || team.status === 'inactive') {
    throw businessError('Team not found');
  }

  await db.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(teamId).update({
    data: {
      colorKey,
      updatedAt: nowIso(deps.now)
    }
  });

  return {
    activityId,
    teamId,
    colorKey,
    updated: true
  };
}

module.exports = { main };
