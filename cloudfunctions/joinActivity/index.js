const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('./collections');
const { resolveOpenId } = require('./auth');
const { normalizeSignupName, validateSignupPayload } = require('./validators');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { notifyActivityManagers } = require('./manager-notifications');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const POSITION_VALUES = ['前锋', '中场', '边锋', '后腰', '中卫', '边卫', '门将'];
const MAX_PREFERRED_POSITIONS = 2;
const MAX_REPEAT_EXIT_COUNT = 3;
const REPEAT_SIGNUP_LIMIT_MESSAGE = 'Too many repeat signups. Please contact the organizer';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSource(value) {
  return value === 'wechat' ? 'wechat' : 'manual';
}

function normalizeCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function getRepeatExitCount(registration) {
  if (!registration) {
    return 0;
  }

  return normalizeCount(registration.cancelCount) + normalizeCount(registration.removedCount);
}

function getDefaultRegistrationNoticeThreshold(signupLimitTotal) {
  const total = normalizeCount(signupLimitTotal);
  return total > 0 ? Math.ceil(total * 0.8) : 0;
}

function getRegistrationNoticeThreshold(activity) {
  const threshold = normalizeCount(activity && activity.registrationNoticeThreshold);
  const total = normalizeCount(activity && activity.signupLimitTotal);

  if (threshold > 0 && threshold <= total) {
    return threshold;
  }

  return getDefaultRegistrationNoticeThreshold(total);
}

function shouldNotifyManagersForJoin(activity, joinedCountAfter) {
  const threshold = getRegistrationNoticeThreshold(activity);
  return threshold > 0 && normalizeCount(joinedCountAfter) >= threshold;
}

function isBenchTeam(team) {
  return team && team.teamType === 'bench';
}

function isActiveRegularTeam(team) {
  return team && team.status !== 'inactive' && team.teamType !== 'bench';
}

function hasTeamCapacity(team) {
  return normalizeCount(team.joinedCount) < normalizeCount(team.maxMembers);
}

function compareTeamOrder(left, right) {
  const leftSort = Number(left && left.sort);
  const rightSort = Number(right && right.sort);
  const normalizedLeftSort = Number.isFinite(leftSort) ? leftSort : 0;
  const normalizedRightSort = Number.isFinite(rightSort) ? rightSort : 0;

  if (normalizedLeftSort !== normalizedRightSort) {
    return normalizedLeftSort - normalizedRightSort;
  }

  return String(left && left._id ? left._id : '').localeCompare(String(right && right._id ? right._id : ''));
}

async function findAvailableRegularTeam(transaction, activityId) {
  const teamsRes = await transaction.collection('activity_teams').where({ activityId }).get();
  return (teamsRes.data || [])
    .filter(team => isActiveRegularTeam(team) && hasTeamCapacity(team))
    .sort(compareTeamOrder)[0] || null;
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

async function writeSignupActivityLog(transaction, data) {
  await transaction.collection(COLLECTIONS.ACTIVITY_LOGS).add({ data });
}

async function syncUserProfile(transaction, openid, profile, stamp) {
  const userRef = transaction.collection('users').doc(openid);
  const userRes = await userRef.get().catch(() => ({ data: null }));
  const data = {
    preferredName: profile.signupName,
    profileSource: profile.profileSource,
    preferredPositions: profile.preferredPositions,
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
    preferredPositions: profile.preferredPositions,
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

async function readTransactionDocument(transaction, collectionName, documentId) {
  try {
    return await transaction.collection(collectionName).doc(documentId).get();
  } catch (error) {
    return { data: null };
  }
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
  const signupName = normalizeSignupName(event.signupName);
  const phone = normalizeText(event.phone);
  const phoneSource = phone ? normalizeSource(event.phoneSource) : '';
  const avatarUrl = normalizeText(event.avatarUrl);
  const profileSource = avatarUrl ? normalizeSource(event.profileSource) : 'manual';

  const transactionResult = await db.runTransaction(async transaction => {
    const activityRes = await transaction.collection('activities').doc(event.activityId).get();
    const teamRes = await transaction.collection('activity_teams').doc(event.teamId).get();
    const registrationRes = await readTransactionDocument(
      transaction,
      'registrations',
      registrationId
    );
    const userRes = await readTransactionDocument(transaction, 'users', openid);
    const actorCanEditActivity = canEditActivity(activityRes.data, userRes.data, openid);

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

    const requestedTeam = teamRes.data;
    const autoAssignedTeam = isBenchTeam(requestedTeam)
      ? await findAvailableRegularTeam(transaction, event.activityId)
      : null;
    const selectedTeam = autoAssignedTeam || requestedTeam;
    const selectedTeamId = selectedTeam._id || event.teamId;
    const autoAssigned = Boolean(autoAssignedTeam);

    if (selectedTeam.joinedCount >= selectedTeam.maxMembers) {
      throw businessError('Team is full');
    }

    if (registrationRes.data && registrationRes.data.status === 'joined') {
      throw businessError('You already joined this activity');
    }

    if (
      !actorCanEditActivity &&
      getRepeatExitCount(registrationRes.data) >= MAX_REPEAT_EXIT_COUNT
    ) {
      throw businessError(REPEAT_SIGNUP_LIMIT_MESSAGE);
    }

    await syncUserProfile(
      transaction,
      openid,
      {
        signupName,
        phone,
        phoneSource,
        avatarUrl,
        profileSource,
        preferredPositions
      },
      stamp
    );

    const registrationData = {
      activityId: event.activityId,
      teamId: selectedTeamId,
      userOpenId: openid,
      status: 'joined',
      signupName,
      avatarUrl,
      profileSource,
      preferredPositions,
      source: event.source || 'direct',
      joinedAt: stamp,
      cancelCount: normalizeCount(registrationRes.data && registrationRes.data.cancelCount),
      removedCount: normalizeCount(registrationRes.data && registrationRes.data.removedCount),
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

    await transaction.collection('activity_teams').doc(selectedTeamId).update({
      data: {
        joinedCount: selectedTeam.joinedCount + 1
      }
    });

    const previousRegistration = registrationRes.data || null;
    const logAction = previousRegistration ? 'signup_rejoined' : 'signup_joined';
    await writeSignupActivityLog(transaction, {
      activityId: event.activityId,
      action: logAction,
      operatorOpenId: openid,
      targetOpenId: openid,
      registrationId,
      teamId: selectedTeamId,
      before: {
        status: previousRegistration ? previousRegistration.status || '' : '',
        teamId: previousRegistration ? previousRegistration.teamId || '' : '',
        cancelCount: normalizeCount(previousRegistration && previousRegistration.cancelCount),
        removedCount: normalizeCount(previousRegistration && previousRegistration.removedCount)
      },
      after: {
        status: 'joined',
        teamId: selectedTeamId,
        signupName,
        preferredPositions,
        source: event.source || 'direct',
        requestedTeamId: event.teamId,
        autoAssigned
      },
      createdAt: stamp
    });

    const joinedCountAfter = normalizeCount(activityRes.data.joinedCount) + 1;
    const shouldNotifyManagers =
      !actorCanEditActivity && shouldNotifyManagersForJoin(activityRes.data, joinedCountAfter);

    return {
      registrationId,
      requestedTeamId: event.teamId,
      teamId: selectedTeamId,
      teamName: selectedTeam.teamName || '',
      status: 'joined',
      autoAssigned,
      autoAssignedReason: autoAssigned ? 'regular_slot_available' : '',
      managerNotification: shouldNotifyManagers
        ? {
            activity: {
              ...activityRes.data,
              _id: event.activityId
            },
            actorOpenId: openid,
            actorName: signupName,
            changeType: 'registration_joined',
            joinedCountAfter,
            signupLimitTotal: normalizeCount(activityRes.data.signupLimitTotal),
            stamp
          }
        : null
    };
  });

  const { managerNotification, ...response } = transactionResult;

  if (managerNotification) {
    const notify = deps.notifyActivityManagers || notifyActivityManagers;
    await notify(db, managerNotification, { ...deps, cloud }).catch(() => null);
  }

  return response;
}

module.exports = { main, normalizePreferredPositions, validatePreferredPositions };
