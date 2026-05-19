const ROLE_ORDER = ['user', 'organizer', 'admin', 'super_admin'];

function normalizeRoles(roles) {
  const values = Array.isArray(roles) ? roles : [];
  const unique = new Set(values.filter(role => ROLE_ORDER.includes(role)));
  unique.add('user');
  return ROLE_ORDER.filter(role => unique.has(role));
}

function getRoles(user) {
  if (Array.isArray(user)) {
    return normalizeRoles(user);
  }

  if (user && Array.isArray(user.roles)) {
    return normalizeRoles(user.roles);
  }

  return ['user'];
}

function hasRole(user, role) {
  return getRoles(user).includes(role);
}

function isSuperAdmin(user) {
  return hasRole(user, 'super_admin');
}

function isAdmin(user) {
  return hasRole(user, 'admin') || isSuperAdmin(user);
}

function canCreateActivity(user) {
  return hasRole(user, 'organizer') || isAdmin(user);
}

function canEditActivity(activity, user, openid) {
  if (isAdmin(user)) {
    return true;
  }

  return Boolean(activity && activity.organizerOpenId && activity.organizerOpenId === openid);
}

function canManageOrganizerRole(user) {
  return isAdmin(user);
}

function canManageAdminRole(user) {
  return isSuperAdmin(user);
}

module.exports = {
  canCreateActivity,
  canEditActivity,
  canManageAdminRole,
  canManageOrganizerRole,
  getRoles,
  hasRole,
  isAdmin,
  isSuperAdmin,
  normalizeRoles
};
