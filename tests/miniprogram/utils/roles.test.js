const {
  canCreateActivity,
  canEditActivity,
  formatRoles
} = require('../../../miniprogram/utils/roles');

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

test('canEditActivity allows the organizer owner and admins', () => {
  const activity = {
    organizerOpenId: 'openid_owner'
  };

  expect(canEditActivity(activity, { roles: ['organizer'] }, 'openid_owner')).toBe(true);
  expect(canEditActivity(activity, { roles: ['admin'] }, 'openid_admin')).toBe(true);
  expect(canEditActivity(activity, { roles: ['organizer'] }, 'openid_other')).toBe(false);
  expect(canEditActivity(activity, { roles: ['user'] }, 'openid_player')).toBe(false);
});
