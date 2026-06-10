const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');
const { normalizeSignupName, validateSignupPayload } = require('./validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const POSITION_VALUES = ['\u524d\u950b', '\u4e2d\u573a', '\u8fb9\u950b', '\u540e\u8170', '\u4e2d\u536b', '\u8fb9\u536b', '\u95e8\u5c06'];
const MAX_PREFERRED_POSITIONS = 2;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePreferredPositions(value) {
  const seen = new Set();
  const input = Array.isArray(value) ? value : [];

  return input.reduce((positions, item) => {
    const position = normalizeText(item);

    if (!POSITION_VALUES.includes(position) || seen.has(position)) {
      return positions;
    }

    seen.add(position);
    positions.push(position);
    return positions;
  }, []);
}

function validatePreferredPositions(value) {
  const input = Array.isArray(value) ? value : [];
  const normalized = normalizePreferredPositions(input);

  if (normalized.length > MAX_PREFERRED_POSITIONS) {
    throw businessError('At most two preferred positions are allowed');
  }

  if (input.some(item => !POSITION_VALUES.includes(normalizeText(item)))) {
    throw businessError('Unsupported preferred position');
  }

  return normalized;
}

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

async function writeActivityLog(transaction, data) {
  await transaction.collection(COLLECTIONS.ACTIVITY_LOGS).add({ data });
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  validateSignupPayload(event);
  const preferredPositions = validatePreferredPositions(event.preferredPositions);
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runAddProxyRegistration) {
    return deps.runAddProxyRegistration({ ...event, preferredPositions }, openid);
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
        preferredPositions,
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

    await writeActivityLog(transaction, {
      activityId: event.activityId,
      action: 'proxy_signup_created',
      operatorOpenId: openid,
      targetOpenId: proxyUserOpenId,
      registrationId,
      teamId: event.teamId,
      before: {
        status: ''
      },
      after: {
        status: 'joined',
        teamId: event.teamId,
        signupName,
        preferredPositions,
        proxyRegistration: true
      },
      createdAt: stamp
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
