const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { validateSignupPayload } = require('./validators');
const { businessError } = require('./errors');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  validateSignupPayload(event);
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runJoin) {
    return deps.runJoin(event, openid);
  }

  const db = cloud.database();
  const registrationId = `${event.activityId}_${openid}`;
  const stamp = nowIso(deps.now);

  return db.runTransaction(async transaction => {
    const activityRes = await transaction.collection('activities').doc(event.activityId).get();
    const teamRes = await transaction.collection('activity_teams').doc(event.teamId).get();
    const registrationRes = await transaction.collection('registrations').doc(registrationId).get().catch(() => ({ data: null }));

    if (activityRes.data.status !== 'published') {
      throw businessError('Activity is not open for signup');
    }

    const deadline = Date.parse(activityRes.data.signupDeadlineAt || '');
    if (Number.isFinite(deadline) && Date.parse(stamp) > deadline) {
      throw businessError('Signup is closed');
    }

    if (activityRes.data.joinedCount >= activityRes.data.signupLimitTotal) {
      throw businessError('Activity is full');
    }

    if (teamRes.data.joinedCount >= teamRes.data.maxMembers) {
      throw businessError('Team is full');
    }

    if (registrationRes.data && registrationRes.data.status === 'joined') {
      throw businessError('You already joined this activity');
    }

    await transaction.collection('registrations').doc(registrationId).set({
      data: {
        _id: registrationId,
        activityId: event.activityId,
        teamId: event.teamId,
        userOpenId: openid,
        status: 'joined',
        signupName: event.signupName.trim(),
        phoneSnapshot: event.phone || '',
        source: event.source || 'direct',
        joinedAt: stamp,
        updatedAt: stamp
      }
    });

    await transaction.collection('activities').doc(event.activityId).update({
      data: {
        joinedCount: activityRes.data.joinedCount + 1,
        updatedAt: stamp
      }
    });

    await transaction.collection('activity_teams').doc(event.teamId).update({
      data: {
        joinedCount: teamRes.data.joinedCount + 1
      }
    });

    return {
      registrationId,
      teamId: event.teamId,
      status: 'joined'
    };
  });
}

module.exports = { main };
