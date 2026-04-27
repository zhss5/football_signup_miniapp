const cloud = require('wx-server-sdk');
const { businessError } = require('./_shared/errors');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (deps.loadActivity) {
    const activity = await deps.loadActivity(event.activityId);
    if (activity.organizerOpenId !== context.OPENID) {
      throw businessError('Not allowed to view activity stats');
    }

    return deps.loadStats ? deps.loadStats(event.activityId) : { activityId: event.activityId, teams: [] };
  }

  const db = cloud.database();
  const activityRes = await db.collection('activities').doc(event.activityId).get();

  if (activityRes.data.organizerOpenId !== context.OPENID) {
    throw businessError('Not allowed to view activity stats');
  }

  const teamsRes = await db.collection('activity_teams').where({ activityId: event.activityId }).get();
  const registrationRes = await db.collection('registrations').where({ activityId: event.activityId }).get();

  return {
    activityId: event.activityId,
    totalJoined: registrationRes.data.filter(item => item.status === 'joined').length,
    totalCancelled: registrationRes.data.filter(item => item.status === 'cancelled').length,
    teams: teamsRes.data.map(team => ({
      teamId: team._id,
      teamName: team.teamName,
      joinedCount: team.joinedCount,
      maxMembers: team.maxMembers
    }))
  };
}

module.exports = { main };
