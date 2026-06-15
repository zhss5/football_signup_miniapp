const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_MANAGER_ALIAS_LENGTH = 128;

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

async function loadCollection(db, collectionName) {
  const res = await db.collection(collectionName).get();
  return Array.isArray(res.data) ? res.data : [];
}

function normalizeManagerAlias(value) {
  return String(value || '').trim();
}

function findRealRegistration(registrations, activityId, targetOpenId) {
  return registrations.find(
    registration =>
      registration &&
      registration.activityId === activityId &&
      registration.userOpenId === targetOpenId &&
      registration.status === 'joined'
  );
}

function toSafeUser(openid, user, updateData) {
  return {
    _id: openid,
    preferredName: user.preferredName || '',
    avatarUrl: user.avatarUrl || '',
    roles: Array.isArray(user.roles) ? user.roles : ['user'],
    managerAlias: updateData.managerAlias,
    managerAliasUpdatedAt: updateData.managerAliasUpdatedAt,
    managerAliasUpdatedBy: updateData.managerAliasUpdatedBy
  };
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const openid = await resolveOpenIdFromEvent(
    event,
    context,
    db,
    { ...deps, getWXContext: deps.getWXContext || (() => cloud.getWXContext()) }
  );
  const activityId = String(payload.activityId || '').trim();
  const targetOpenId = String(payload.targetOpenId || '').trim();
  const managerAlias = normalizeManagerAlias(payload.managerAlias);
  const stamp = nowIso(deps.now);

  if (!activityId) {
    throw businessError('activityId is required');
  }

  if (!targetOpenId) {
    throw businessError('targetOpenId is required');
  }

  if (managerAlias.length > MAX_MANAGER_ALIAS_LENGTH) {
    throw businessError('managerAlias cannot exceed 128 characters');
  }

  const [activity, actor, registrations] = await Promise.all([
    loadDoc(db, COLLECTIONS.ACTIVITIES, activityId),
    loadDoc(db, COLLECTIONS.USERS, openid),
    loadCollection(db, COLLECTIONS.REGISTRATIONS)
  ]);

  if (!activity) {
    throw businessError('Activity not found');
  }

  if (!canEditActivity(activity, actor, openid)) {
    throw businessError('Only the organizer or an admin can update manager aliases');
  }

  const registration = findRealRegistration(registrations, activityId, targetOpenId);
  if (!registration) {
    throw businessError('Target user is not an active registration in this activity');
  }

  if (registration.proxyRegistration === true) {
    throw businessError('Manager aliases can only be set for real signup users');
  }

  const targetUser = await loadDoc(db, COLLECTIONS.USERS, targetOpenId);
  if (!targetUser) {
    throw businessError('User not found');
  }

  const updateData = {
    managerAlias,
    managerAliasUpdatedAt: stamp,
    managerAliasUpdatedBy: openid
  };

  await db.collection(COLLECTIONS.USERS).doc(targetOpenId).update({
    data: updateData
  });

  await db.collection(COLLECTIONS.ACTIVITY_LOGS).add({
    data: {
      activityId,
      action: 'manager_alias_update',
      operatorOpenId: openid,
      targetOpenId,
      registrationId: registration._id || '',
      before: {
        managerAlias: targetUser.managerAlias || ''
      },
      after: {
        managerAlias
      },
      createdAt: stamp
    }
  });

  return {
    user: toSafeUser(targetOpenId, targetUser, updateData)
  };
}

module.exports = { main };
