const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { businessError } = require('./errors');
const { COLLECTIONS } = require('./collections');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runDeleteActivity) {
    return deps.runDeleteActivity(event, openid);
  }

  const db = deps.db || cloud.database();
  const stamp = typeof deps.now === 'function' ? deps.now() : new Date().toISOString();

  await db.runTransaction(async transaction => {
    const activityRes = await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).get();
    const activity = activityRes.data;

    if (!activity) {
      throw businessError('Activity not found');
    }

    if (activity.organizerOpenId !== openid) {
      throw businessError('Only the organizer can delete this activity');
    }

    if (Number(activity.joinedCount) > 0) {
      throw businessError('Only activities without joined players can be deleted');
    }

    await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).update({
      data: {
        status: 'deleted',
        updatedAt: stamp
      }
    });
  });

  return {
    activityId: event.activityId,
    status: 'deleted'
  };
}

module.exports = { main };
