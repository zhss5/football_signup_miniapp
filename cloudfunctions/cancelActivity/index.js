const cloud = require('wx-server-sdk');
const { businessError } = require('./errors');
const { nowIso } = require('./time');
const { COLLECTIONS } = require('./collections');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (deps.runCancelActivity) {
    return deps.runCancelActivity(event, context.OPENID);
  }

  const db = deps.db || cloud.database();
  const stamp = nowIso(deps.now);

  return db.runTransaction(async transaction => {
    const activityRes = await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).get();
    const activity = activityRes.data;

    if (!activity) {
      throw businessError('Activity not found');
    }

    if (activity.organizerOpenId !== context.OPENID) {
      throw businessError('Only the organizer can cancel this activity');
    }

    if (activity.status === 'cancelled') {
      return {
        activityId: event.activityId,
        status: 'cancelled'
      };
    }

    await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).update({
      data: {
        status: 'cancelled',
        updatedAt: stamp
      }
    });

    return {
      activityId: event.activityId,
      status: 'cancelled'
    };
  });
}

module.exports = { main };
