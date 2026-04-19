const cloud = require('wx-server-sdk');
const { businessError } = require('../_shared/errors');
const { nowIso } = require('../_shared/time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (deps.runCancel) {
    return deps.runCancel(event, context.OPENID);
  }

  const db = cloud.database();
  const registrationId = `${event.activityId}_${context.OPENID}`;
  const stamp = nowIso();

  return db.runTransaction(async transaction => {
    const registrationRes = await transaction.collection('registrations').doc(registrationId).get();

    if (!registrationRes.data || registrationRes.data.status !== 'joined') {
      throw businessError('No active registration to cancel');
    }

    const activityRes = await transaction.collection('activities').doc(event.activityId).get();
    const teamRes = await transaction.collection('activity_teams').doc(registrationRes.data.teamId).get();

    await transaction.collection('registrations').doc(registrationId).update({
      data: {
        status: 'cancelled',
        cancelledAt: stamp,
        updatedAt: stamp
      }
    });

    await transaction.collection('activities').doc(event.activityId).update({
      data: {
        joinedCount: Math.max(activityRes.data.joinedCount - 1, 0),
        updatedAt: stamp
      }
    });

    await transaction.collection('activity_teams').doc(registrationRes.data.teamId).update({
      data: {
        joinedCount: Math.max(teamRes.data.joinedCount - 1, 0)
      }
    });

    return {
      registrationId,
      status: 'cancelled'
    };
  });
}

module.exports = { main };
