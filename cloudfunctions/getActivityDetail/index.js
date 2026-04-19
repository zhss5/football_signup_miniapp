const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (deps.loadActivityDetail) {
    return deps.loadActivityDetail(event.activityId, context.OPENID);
  }

  const db = cloud.database();
  const activity = await db.collection('activities').doc(event.activityId).get();
  const teamsRes = await db.collection('activity_teams').where({ activityId: event.activityId }).get();
  const registrationId = `${event.activityId}_${context.OPENID}`;
  const myRegistration = await db.collection('registrations').doc(registrationId).get().catch(() => ({ data: null }));

  return {
    activity: activity.data,
    teams: teamsRes.data.map(team => ({ ...team, members: [] })),
    myRegistration: myRegistration.data
  };
}

module.exports = { main };
