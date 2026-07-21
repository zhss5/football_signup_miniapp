const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { nowIso } = require('./time');
const { normalizeSignupName } = require('./validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const POSITION_VALUES = ['前锋', '中场', '边锋', '后腰', '中卫', '边卫', '门将'];
const MAX_PREFERRED_POSITIONS = 2;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeProfileSource(value, avatarUrl) {
  return avatarUrl && value === 'wechat' ? 'wechat' : 'manual';
}

function validatePreferredPositions(value) {
  const input = Array.isArray(value) ? value : [];

  if (input.length > MAX_PREFERRED_POSITIONS) {
    throw businessError('At most two preferred positions are allowed');
  }

  const normalized = input.map(normalizeText);
  if (normalized.some(position => !POSITION_VALUES.includes(position))) {
    throw businessError('Unsupported preferred position');
  }

  return [...new Set(normalized)];
}

function toProfile(registration) {
  return {
    signupName: registration.signupName || '',
    avatarUrl: registration.avatarUrl || '',
    profileSource: registration.profileSource || 'manual',
    preferredPositions: Array.isArray(registration.preferredPositions)
      ? registration.preferredPositions
      : []
  };
}

async function main(event = {}, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const activityId = normalizeText(event.activityId);
  const signupName = normalizeSignupName(event.signupName);
  const avatarUrl = normalizeText(event.avatarUrl);
  const profileSource = normalizeProfileSource(event.profileSource, avatarUrl);
  const preferredPositions = validatePreferredPositions(event.preferredPositions);
  const stamp = nowIso(deps.now);

  if (!activityId) {
    throw businessError('activityId is required');
  }

  if (!signupName) {
    throw businessError('signupName is required');
  }

  const registrationId = `${activityId}_${openid}`;

  return db.runTransaction(async transaction => {
    const activityRes = await transaction
      .collection(COLLECTIONS.ACTIVITIES)
      .doc(activityId)
      .get();
    const activity = activityRes && activityRes.data;

    if (!activity) {
      throw businessError('Activity not found');
    }

    if (activity.status !== 'published') {
      throw businessError('Activity is not open for signup');
    }

    const startAt = Date.parse(activity.startAt || '');
    const nowAt = Date.parse(stamp);
    if (!Number.isFinite(startAt)) {
      throw businessError('Activity start time is invalid');
    }
    if (nowAt >= startAt) {
      throw businessError('Registration profile is locked after activity start');
    }

    const registrationRef = transaction
      .collection(COLLECTIONS.REGISTRATIONS)
      .doc(registrationId);
    const registrationRes = await registrationRef.get();
    const registration = registrationRes && registrationRes.data;

    if (!registration || registration.activityId !== activityId || registration.userOpenId !== openid) {
      throw businessError('Registration not found');
    }

    if (registration.status !== 'joined') {
      throw businessError('Only joined registrations can be edited');
    }

    if (registration.proxyRegistration === true || openid.startsWith('proxy_')) {
      throw businessError('Proxy registrations cannot be edited');
    }

    const before = toProfile(registration);
    const after = {
      signupName,
      avatarUrl,
      profileSource,
      preferredPositions
    };

    await registrationRef.update({
      data: {
        ...after,
        updatedAt: stamp
      }
    });

    const userRef = transaction.collection(COLLECTIONS.USERS).doc(openid);
    const userRes = await userRef.get();
    const userUpdate = {
      preferredName: signupName,
      avatarUrl,
      profileSource,
      preferredPositions,
      lastActiveAt: stamp,
      updatedAt: stamp
    };

    if (userRes && userRes.data) {
      await userRef.update({ data: userUpdate });
    } else {
      await userRef.set({
        data: {
          ...userUpdate,
          roles: ['user'],
          createdAt: stamp
        }
      });
    }

    await transaction.collection(COLLECTIONS.ACTIVITY_LOGS).add({
      data: {
        activityId,
        action: 'registration_profile_update',
        operatorOpenId: openid,
        targetOpenId: openid,
        registrationId,
        before,
        after,
        createdAt: stamp
      }
    });

    return {
      registrationId,
      activityId,
      ...after,
      updatedAt: stamp
    };
  });
}

module.exports = {
  main,
  validatePreferredPositions
};
