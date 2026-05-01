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

  if (!event.targetTeamId) {
    throw new Error('targetTeamId is required');
  }
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  validatePayload(event);
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runMoveRegistration) {
    return deps.runMoveRegistration(event, openid);
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
      throw businessError('Only the organizer or an admin can move registrations');
    }

    if (activity.status !== 'published') {
      throw businessError('Activity is not open for roster changes');
    }

    const registrationRes = await transaction
      .collection(COLLECTIONS.REGISTRATIONS)
      .doc(registrationId)
      .get()
      .catch(() => ({ data: null }));
    const registration = registrationRes.data;

    if (!registration || registration.status !== 'joined') {
      throw businessError('No active registration to move');
    }

    if (registration.teamId === event.targetTeamId) {
      throw businessError('Already in target team');
    }

    const targetTeamRes = await transaction
      .collection(COLLECTIONS.ACTIVITY_TEAMS)
      .doc(event.targetTeamId)
      .get();
    const targetTeam = targetTeamRes.data;

    if (
      !targetTeam ||
      targetTeam.activityId !== event.activityId ||
      targetTeam.status === 'inactive'
    ) {
      throw businessError('Team not found');
    }

    if (Number(targetTeam.joinedCount || 0) >= Number(targetTeam.maxMembers || 0)) {
      throw businessError('Team is full');
    }

    const sourceTeamRes = await transaction
      .collection(COLLECTIONS.ACTIVITY_TEAMS)
      .doc(registration.teamId)
      .get()
      .catch(() => ({ data: null }));
    const sourceTeam = sourceTeamRes.data || {};

    await transaction.collection(COLLECTIONS.REGISTRATIONS).doc(registrationId).update({
      data: {
        teamId: event.targetTeamId,
        movedByOpenId: openid,
        movedAt: stamp,
        updatedAt: stamp
      }
    });

    await transaction.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(registration.teamId).update({
      data: {
        joinedCount: Math.max(Number(sourceTeam.joinedCount || 0) - 1, 0)
      }
    });

    await transaction.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(event.targetTeamId).update({
      data: {
        joinedCount: Number(targetTeam.joinedCount || 0) + 1
      }
    });

    await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).update({
      data: {
        updatedAt: stamp
      }
    });

    return {
      registrationId,
      activityId: event.activityId,
      userOpenId: event.userOpenId,
      fromTeamId: registration.teamId,
      teamId: event.targetTeamId,
      status: 'joined',
      moved: true
    };
  });
}

module.exports = { main };
