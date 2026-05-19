const {
  canCreateActivity,
  canEditActivity,
  canManageAdminRole,
  canManageOrganizerRole,
  getRoles,
  hasRole,
  isAdmin,
  isSuperAdmin,
  normalizeRoles
} = require('../../cloudfunctions/_shared/roles');

test('normalizeRoles always keeps base user and removes duplicates', () => {
  expect(normalizeRoles(['organizer', 'user', 'organizer'])).toEqual(['user', 'organizer']);
  expect(normalizeRoles(['super_admin', 'unknown', 'admin'])).toEqual([
    'user',
    'admin',
    'super_admin'
  ]);
});

test('super_admin can create and edit activities like admin', () => {
  const user = { roles: ['user', 'super_admin'] };

  expect(canCreateActivity(user)).toBe(true);
  expect(canEditActivity({ organizerOpenId: 'openid_other' }, user, 'openid_root')).toBe(true);
});

test('admin and super_admin role management boundaries are explicit', () => {
  expect(canManageOrganizerRole({ roles: ['admin'] })).toBe(true);
  expect(canManageAdminRole({ roles: ['admin'] })).toBe(false);
  expect(canManageOrganizerRole({ roles: ['super_admin'] })).toBe(true);
  expect(canManageAdminRole({ roles: ['super_admin'] })).toBe(true);
  expect(isAdmin({ roles: ['admin'] })).toBe(true);
  expect(isAdmin({ roles: ['super_admin'] })).toBe(true);
  expect(isSuperAdmin({ roles: ['super_admin'] })).toBe(true);
  expect(hasRole({ roles: ['user'] }, 'admin')).toBe(false);
  expect(getRoles({ roles: ['user'] })).toEqual(['user']);
});
