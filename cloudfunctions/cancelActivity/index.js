const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { businessError } = require('./errors');
const { nowIso } = require('./time');
const { COLLECTIONS } = require('./collections');
const { canEditActivity } = require('./roles');

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
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runCancelActivity) {
    return deps.runCancelActivity(event, openid);
  }

  const db = deps.db || cloud.database();
  const stamp = nowIso(deps.now);
  const user = await getCurrentUser(db, openid);

  return db.runTransaction(async transaction => {
    const activityRes = await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).get();
    const activity = activityRes.data;

    if (!activity) {
      throw businessError('Activity not found');
    }

    if (!canEditActivity(activity, user, openid)) {
      throw businessError('Only the organizer or an admin can cancel this activity');
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
