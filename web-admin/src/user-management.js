(function initUserManagement(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./roles'));
    return;
  }

  root.WebAdminUserManagement = factory(root.WebAdminRoles);
})(typeof globalThis !== 'undefined' ? globalThis : this, function userManagementFactory(roles) {
  function normalizeNumber(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      return fallback;
    }

    return Math.floor(number);
  }

  function buildSearchParams(input = {}) {
    return {
      keyword: String(input.keyword || '').trim(),
      role: String(input.role || '').trim(),
      limit: normalizeNumber(input.limit, 20) || 20,
      skip: normalizeNumber(input.skip, 0)
    };
  }

  function getDisplayName(user = {}) {
    return (
      String(user.preferredName || '').trim() ||
      String(user.displayName || '').trim() ||
      String(user.nickName || user.nickname || '').trim() ||
      String(user._id || '').trim()
    );
  }

  function buildUserRows(users = [], operator) {
    return users.map(user => {
      const normalizedRoles = roles.normalizeRoles(user.roles);

      return {
        openid: user._id || '',
        displayName: getDisplayName(user),
        avatarUrl: String(user.avatarUrl || '').trim(),
        managerAlias: String(user.managerAlias || '').trim(),
        rolesText: normalizedRoles.join(', '),
        roleControls: roles.buildRoleControls(operator, {
          ...user,
          roles: normalizedRoles
        })
      };
    });
  }

  function assertRoleCanBeChanged(operator, role) {
    if (roles.getEditableRoles(operator).includes(role)) {
      return;
    }

    if (role === 'admin') {
      throw new Error('Only super admins can manage admin roles');
    }

    throw new Error('Only admins can manage organizer roles');
  }

  function buildRoleUpdatePayload(operator, targetUser, changes = {}) {
    const nextRoles = new Set(roles.normalizeRoles(targetUser.roles));

    roles.MANAGEABLE_ROLES.forEach(role => {
      if (!Object.prototype.hasOwnProperty.call(changes, role)) {
        return;
      }

      assertRoleCanBeChanged(operator, role);

      if (changes[role]) {
        nextRoles.add(role);
      } else {
        nextRoles.delete(role);
      }
    });

    return {
      targetOpenId: targetUser._id || '',
      roles: roles.normalizeRoles(Array.from(nextRoles))
    };
  }

  return {
    buildRoleUpdatePayload,
    buildSearchParams,
    buildUserRows,
    getDisplayName
  };
});
