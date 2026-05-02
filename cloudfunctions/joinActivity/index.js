const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { validateSignupPayload } = require('./validators');
const { businessError } = require('./errors');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const POSITION_VALUES = ['前锋', '中场', '边锋', '后腰', '中卫', '边卫', '门将'];
const MAX_PREFERRED_POSITIONS = 2;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSource(value) {
  return value === 'wechat' ? 'wechat' : 'manual';
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

async function syncUserProfile(transaction, openid, profile, stamp) {
  const userRef = transaction.collection('users').doc(openid);
  const userRes = await userRef.get().catch(() => ({ data: null }));
  const data = {
    preferredName: profile.signupName,
    profileSource: profile.profileSource,
    lastActiveAt: stamp,
    updatedAt: stamp
  };

  if (profile.avatarUrl) {
    data.avatarUrl = profile.avatarUrl;
  }

  if (profile.phone) {
    data.phoneNumber = profile.phone;
    data.phoneSource = profile.phoneSource;
  }

  if (userRes.data) {
    await userRef.update({ data });
    return;
  }

  const newUserData = {
    preferredName: profile.signupName,
    avatarUrl: profile.avatarUrl || '',
    profileSource: profile.profileSource,
    roles: ['user'],
    createdAt: stamp,
    lastActiveAt: stamp,
    updatedAt: stamp
  };

  if (profile.phone) {
    newUserData.phoneNumber = profile.phone;
    newUserData.phoneSource = profile.phoneSource;
  }

  await userRef.set({ data: newUserData });
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  validateSignupPayload(event);
  const preferredPositions = validatePreferredPositions(event.preferredPositions);
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runJoin) {
    return deps.runJoin({ ...event, preferredPositions }, openid);
  }

  const db = cloud.database();
  const registrationId = `${event.activityId}_${openid}`;
  const stamp = nowIso(deps.now);
  const signupName = normalizeText(event.signupName);
  const phone = normalizeText(event.phone);
  const phoneSource = phone ? normalizeSource(event.phoneSource) : '';
  const avatarUrl = normalizeText(event.avatarUrl);
  const profileSource = avatarUrl ? normalizeSource(event.profileSource) : 'manual';

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

    await syncUserProfile(
      transaction,
      openid,
      {
        signupName,
        phone,
        phoneSource,
        avatarUrl,
        profileSource
      },
      stamp
    );

    const registrationData = {
      activityId: event.activityId,
      teamId: event.teamId,
      userOpenId: openid,
      status: 'joined',
      signupName,
      avatarUrl,
      profileSource,
      preferredPositions,
      source: event.source || 'direct',
      joinedAt: stamp,
      updatedAt: stamp
    };

    if (phone) {
      registrationData.phoneSnapshot = phone;
      registrationData.phoneSource = phoneSource;
    }

    await transaction.collection('registrations').doc(registrationId).set({
      data: registrationData
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

module.exports = { main, normalizePreferredPositions, validatePreferredPositions };
