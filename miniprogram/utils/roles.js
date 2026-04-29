function getRoles(user) {
  if (Array.isArray(user)) {
    return user.filter(Boolean);
  }

  if (user && Array.isArray(user.roles)) {
    return user.roles.filter(Boolean);
  }

  return [];
}

function canCreateActivity(user) {
  const roles = getRoles(user);
  return roles.includes('organizer') || roles.includes('admin');
}

function canEditActivity(activity, user, openid) {
  const roles = getRoles(user);

  if (roles.includes('admin')) {
    return true;
  }

  return Boolean(activity && activity.organizerOpenId && activity.organizerOpenId === openid);
}

function formatRoles(user) {
  const roles = getRoles(user);
  return roles.length ? roles.join(', ') : 'user';
}

module.exports = {
  canCreateActivity,
  canEditActivity,
  formatRoles,
  getRoles
};
