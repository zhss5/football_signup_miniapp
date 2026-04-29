const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function validatePayload(event = {}) {
  if (!event.activityId) {
    throw new Error('activityId is required');
  }

  if (!event.userOpenId) {
    throw new Error('userOpenId is required');
  }
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  validatePayload(event);
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runRemove) {
    return deps.runRemove(event, openid);
  }

  const db = deps.db || cloud.database();
  const stamp = nowIso(deps.now);
  const registrationId = `${event.activityId}_${event.userOpenId}`;

  return db.runTransaction(async transaction => {
    const activityRes = await transaction
      .collection(COLLECTIONS.ACTIVITIES)
      .doc(event.activityId)
      .get();
    const activity = activityRes.data;

    if (!activity || activity.status === 'deleted') {
      throw businessError('Activity not found');
    }

    const actorRes = await transaction
      .collection(COLLECTIONS.USERS)
      .doc(openid)
      .get()
      .catch(() => ({ data: null }));
    const actor = actorRes.data || null;

    if (!canEditActivity(activity, actor, openid)) {
      throw businessError('Only the organizer or an admin can remove registrations');
    }

    const registrationRes = await transaction
      .collection(COLLECTIONS.REGISTRATIONS)
      .doc(registrationId)
      .get()
      .catch(() => ({ data: null }));
    const registration = registrationRes.data;

    if (!registration || registration.status !== 'joined') {
      throw businessError('No active registration to remove');
    }

    const teamRes = await transaction
      .collection(COLLECTIONS.ACTIVITY_TEAMS)
      .doc(registration.teamId)
      .get();
    const team = teamRes.data || {};

    await transaction.collection(COLLECTIONS.REGISTRATIONS).doc(registrationId).update({
      data: {
        status: 'cancelled',
        cancelledAt: stamp,
        removedByOpenId: openid,
        removedAt: stamp,
        updatedAt: stamp
      }
    });

    await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).update({
      data: {
        joinedCount: Math.max(Number(activity.joinedCount || 0) - 1, 0),
        updatedAt: stamp
      }
    });

    await transaction.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(registration.teamId).update({
      data: {
        joinedCount: Math.max(Number(team.joinedCount || 0) - 1, 0)
      }
    });

    return {
      registrationId,
      activityId: event.activityId,
      userOpenId: event.userOpenId,
      teamId: registration.teamId,
      status: 'cancelled',
      removed: true
    };
  });
}

module.exports = { main };
