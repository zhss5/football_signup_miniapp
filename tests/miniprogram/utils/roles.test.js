const { canCreateActivity, formatRoles } = require('../../../miniprogram/utils/roles');

test('canCreateActivity allows organizers and admins only', () => {
  expect(canCreateActivity({ roles: ['user'] })).toBe(false);
  expect(canCreateActivity({ roles: ['user', 'organizer'] })).toBe(true);
  expect(canCreateActivity({ roles: ['admin'] })).toBe(true);
  expect(canCreateActivity(null)).toBe(false);
});

test('formatRoles returns a readable role summary', () => {
  expect(formatRoles({ roles: ['user', 'organizer'] })).toBe('user, organizer');
  expect(formatRoles({ roles: [] })).toBe('user');
  expect(formatRoles(null)).toBe('user');
});
