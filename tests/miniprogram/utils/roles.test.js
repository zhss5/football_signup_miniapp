const {
  canCreateActivity,
  canEditActivity,
  canManageAdminRole,
  canManageOrganizerRole,
  formatRoles,
  getRoles,
  isAdmin,
  isSuperAdmin
} = require('../../../miniprogram/utils/roles');

test('canCreateActivity allows organizers, admins, and super admins only', () => {
  expect(canCreateActivity({ roles: ['user'] })).toBe(false);
  expect(canCreateActivity({ roles: ['user', 'organizer'] })).toBe(true);
  expect(canCreateActivity({ roles: ['admin'] })).toBe(true);
  expect(canCreateActivity({ roles: ['super_admin'] })).toBe(true);
  expect(canCreateActivity(null)).toBe(false);
});

test('formatRoles returns a readable role summary', () => {
  expect(formatRoles({ roles: ['user', 'organizer'] })).toBe('user, organizer');
  expect(formatRoles({ roles: ['organizer', 'user', 'organizer'] })).toBe('user, organizer');
  expect(formatRoles({ roles: [] })).toBe('user');
  expect(formatRoles(null)).toBe('user');
});

test('canEditActivity allows the organizer owner and admins', () => {
  const activity = {
    organizerOpenId: 'openid_owner'
  };

  expect(canEditActivity(activity, { roles: ['organizer'] }, 'openid_owner')).toBe(true);
  expect(canEditActivity(activity, { roles: ['admin'] }, 'openid_admin')).toBe(true);
  expect(canEditActivity(activity, { roles: ['super_admin'] }, 'openid_root')).toBe(true);
  expect(canEditActivity(activity, { roles: ['organizer'] }, 'openid_other')).toBe(false);
  expect(canEditActivity(activity, { roles: ['user'] }, 'openid_player')).toBe(false);
});

test('role helpers expose version 2 management boundaries', () => {
  expect(getRoles({ roles: ['super_admin', 'unknown', 'admin'] })).toEqual([
    'user',
    'admin',
    'super_admin'
  ]);
  expect(isAdmin({ roles: ['super_admin'] })).toBe(true);
  expect(isSuperAdmin({ roles: ['super_admin'] })).toBe(true);
  expect(canManageOrganizerRole({ roles: ['admin'] })).toBe(true);
  expect(canManageAdminRole({ roles: ['admin'] })).toBe(false);
  expect(canManageAdminRole({ roles: ['super_admin'] })).toBe(true);
});
