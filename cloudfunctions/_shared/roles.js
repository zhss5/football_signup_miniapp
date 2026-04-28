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

module.exports = {
  canCreateActivity,
  getRoles
};
