(function initRoles(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.WebAdminRoles = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function rolesFactory() {
  const ROLE_ORDER = ['user', 'organizer', 'admin', 'super_admin'];
  const MANAGEABLE_ROLES = ['organizer', 'admin'];

  function normalizeRoles(roles) {
    const source = Array.isArray(roles) ? roles : [];
    const unique = new Set(source.filter(role => ROLE_ORDER.includes(role)));
    unique.add('user');
    return ROLE_ORDER.filter(role => unique.has(role));
  }

  function getRoles(user) {
    return normalizeRoles(user && user.roles);
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

  function canAccessWebAdmin(user) {
    return hasRole(user, 'organizer') || isAdmin(user);
  }

  function getEditableRoles(operator) {
    if (isSuperAdmin(operator)) {
      return ['organizer', 'admin'];
    }

    if (isAdmin(operator)) {
      return ['organizer'];
    }

    return [];
  }

  function buildRoleControls(operator, targetUser) {
    const editableRoles = new Set(getEditableRoles(operator));
    const targetRoles = getRoles(targetUser);

    return MANAGEABLE_ROLES.map(role => ({
      role,
      checked: targetRoles.includes(role),
      disabled: !editableRoles.has(role)
    }));
  }

  function buildAccessState(user) {
    const roles = getRoles(user);

    if (!canAccessWebAdmin({ roles })) {
      return {
        allowed: false,
        reason: 'admin_required',
        roles
      };
    }

    return {
      allowed: true,
      reason: '',
      roles
    };
  }

  return {
    ROLE_ORDER,
    MANAGEABLE_ROLES,
    buildAccessState,
    buildRoleControls,
    canAccessWebAdmin,
    getEditableRoles,
    getRoles,
    hasRole,
    isAdmin,
    isSuperAdmin,
    normalizeRoles
  };
});
