const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const {
  canManageAdminRole,
  canManageOrganizerRole,
  getRoles,
  hasRole,
  isAdmin,
  normalizeRoles
} = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
}

async function countSuperAdmins(db) {
  const res = await db.collection(COLLECTIONS.USERS).get();
  const users = Array.isArray(res.data) ? res.data : [];
  return users.filter(user => hasRole(user, 'super_admin')).length;
}

function rolesChanged(previousRoles, nextRoles, role) {
  return previousRoles.includes(role) !== nextRoles.includes(role);
}

function toSafeUser(openid, user, roles) {
  return {
    _id: openid,
    preferredName: user.preferredName || '',
    displayName: user.displayName || '',
    nickName: user.nickName || user.nickname || '',
    avatarUrl: user.avatarUrl || '',
    roles,
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
  const stamp = nowIso(deps.now);
  const caller = await loadUser(db, openid);

  if (!isAdmin(caller)) {
    throw businessError('Only admins can manage user roles');
  }

  const targetOpenId = String(payload.targetOpenId || '').trim();
  if (!targetOpenId) {
    throw businessError('targetOpenId is required');
  }

  const target = await loadUser(db, targetOpenId);
  if (!target) {
    throw businessError('User not found');
  }

  const previousRoles = getRoles(target);
  const nextRoles = normalizeRoles(payload.roles);
  const adminRoleChanged =
    rolesChanged(previousRoles, nextRoles, 'admin') ||
    rolesChanged(previousRoles, nextRoles, 'super_admin');
  const organizerRoleChanged = rolesChanged(previousRoles, nextRoles, 'organizer');

  if (adminRoleChanged && !canManageAdminRole(caller)) {
    throw businessError('Only super admins can manage admin roles');
  }

  if (organizerRoleChanged && !canManageOrganizerRole(caller)) {
    throw businessError('Only admins can manage organizer roles');
  }

  if (previousRoles.includes('super_admin') && !nextRoles.includes('super_admin')) {
    const superAdminCount = await countSuperAdmins(db);
    if (superAdminCount <= 1) {
      throw businessError('Cannot remove the last super admin');
    }
  }

  if (
    targetOpenId === openid &&
    ((previousRoles.includes('super_admin') && !nextRoles.includes('super_admin')) ||
      (previousRoles.includes('admin') && !nextRoles.includes('admin')))
  ) {
    throw businessError('Cannot remove your own highest admin role');
  }

  await db.collection(COLLECTIONS.USERS).doc(targetOpenId).update({
    data: {
      roles: nextRoles,
      rolesUpdatedAt: stamp,
      rolesUpdatedBy: openid
    }
  });

  await db.collection(COLLECTIONS.USER_ROLE_LOGS).add({
    data: {
      action: 'update_user_roles',
      operatorOpenId: openid,
      targetOpenId,
      previousRoles,
      nextRoles,
      createdAt: stamp
    }
  });

  return {
    user: toSafeUser(targetOpenId, target, nextRoles)
  };
}

module.exports = { main };
