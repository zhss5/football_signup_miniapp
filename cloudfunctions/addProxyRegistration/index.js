const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');
const { normalizeSignupName, validateSignupPayload } = require('./validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function buildProxyUserOpenId(activityId, stamp, deps = {}) {
  const suffix =
    deps.idSuffix ||
    Math.random()
      .toString(36)
      .slice(2, 10) ||
    'proxy';
  const timePart = Date.parse(stamp);
  const stableTimePart = Number.isFinite(timePart) ? timePart : Date.now();

  return `proxy_${activityId}_${stableTimePart}_${suffix}`;
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  validateSignupPayload(event);
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runAddProxyRegistration) {
    return deps.runAddProxyRegistration(event, openid);
  }

  const db = deps.db || cloud.database();
  const stamp = nowIso(deps.now);
  const signupName = normalizeSignupName(event.signupName);

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
      throw businessError('Only the organizer or an admin can add participants');
    }

    if (activity.status !== 'published') {
      throw businessError('Activity is not open for signup');
    }

    const deadline = Date.parse(activity.signupDeadlineAt || '');
    if (Number.isFinite(deadline) && Date.parse(stamp) > deadline) {
      throw businessError('Signup is closed');
    }

    if (Number(activity.joinedCount || 0) >= Number(activity.signupLimitTotal || 0)) {
      throw businessError('Activity is full');
    }

    const teamRes = await transaction
      .collection(COLLECTIONS.ACTIVITY_TEAMS)
      .doc(event.teamId)
      .get();
    const team = teamRes.data;

    if (!team || team.activityId !== event.activityId || team.status === 'inactive') {
      throw businessError('Team not found');
    }

    if (Number(team.joinedCount || 0) >= Number(team.maxMembers || 0)) {
      throw businessError('Team is full');
    }

    const proxyUserOpenId = buildProxyUserOpenId(event.activityId, stamp, deps);
    const registrationId = `${event.activityId}_${proxyUserOpenId}`;

    await transaction.collection(COLLECTIONS.REGISTRATIONS).doc(registrationId).set({
      data: {
        activityId: event.activityId,
        teamId: event.teamId,
        userOpenId: proxyUserOpenId,
        status: 'joined',
        signupName,
        avatarUrl: '',
        profileSource: 'proxy',
        source: 'proxy',
        proxyRegistration: true,
        createdByOpenId: openid,
        joinedAt: stamp,
        updatedAt: stamp
      }
    });

    await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).update({
      data: {
        joinedCount: Number(activity.joinedCount || 0) + 1,
        updatedAt: stamp
      }
    });

    await transaction.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(event.teamId).update({
      data: {
        joinedCount: Number(team.joinedCount || 0) + 1
      }
    });

    return {
      registrationId,
      teamId: event.teamId,
      userOpenId: proxyUserOpenId,
      status: 'joined',
      proxyRegistration: true
    };
  });
}

module.exports = { main };
