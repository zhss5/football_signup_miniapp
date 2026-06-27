const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { getRoles, isAdmin } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_MANAGER_ALIAS_LENGTH = 40;

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
}

function normalizeManagerAlias(value) {
  return String(value || '').trim();
}

function toSafeUser(openid, user, managerAlias, stamp, actorOpenId) {
  return {
    _id: openid,
    preferredName: user.preferredName || '',
    displayName: user.displayName || '',
    nickName: user.nickName || user.nickname || '',
    avatarUrl: user.avatarUrl || '',
    managerAlias,
    managerAliasUpdatedAt: stamp,
    managerAliasUpdatedBy: actorOpenId,
    roles: getRoles(user),
    createdAt: user.createdAt || '',
    lastActiveAt: user.lastActiveAt || ''
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
  const caller = await loadUser(db, openid);

  if (!isAdmin(caller)) {
    throw businessError('Only admins can update user manager aliases');
  }

  const targetOpenId = String(payload.targetOpenId || '').trim();
  if (!targetOpenId) {
    throw businessError('targetOpenId is required');
  }

  const managerAlias = normalizeManagerAlias(payload.managerAlias);
  if (managerAlias.length > MAX_MANAGER_ALIAS_LENGTH) {
    throw businessError('managerAlias cannot exceed 40 characters');
  }

  const targetUser = await loadUser(db, targetOpenId);
  if (!targetUser) {
    throw businessError('User not found');
  }

  const stamp = nowIso(deps.now);
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
      activityId: '',
      action: 'manager_alias_update',
      operatorOpenId: openid,
      targetOpenId,
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
    user: toSafeUser(targetOpenId, targetUser, managerAlias, stamp, openid)
  };
}

module.exports = { main };
