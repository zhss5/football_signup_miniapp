const {
  buildAccessState,
  buildRoleControls,
  canAccessWebAdmin,
  getEditableRoles,
  normalizeRoles
} = require('../../web-admin/src/roles');

test('normalizeRoles keeps stable web-admin role ordering', () => {
  expect(normalizeRoles(['organizer', 'admin', 'user', 'organizer'])).toEqual([
    'user',
    'organizer',
    'admin'
  ]);
});

test('regular users cannot access the web admin', () => {
  const user = {
    _id: 'openid_user',
    roles: ['user']
  };

  expect(canAccessWebAdmin(user)).toBe(false);
  expect(buildAccessState(user)).toEqual({
    allowed: false,
    reason: 'admin_required',
    roles: ['user']
  });
});

test('admins and super admins can access the web admin', () => {
  expect(canAccessWebAdmin({ roles: ['user', 'admin'] })).toBe(true);
  expect(canAccessWebAdmin({ roles: ['user', 'super_admin'] })).toBe(true);
});

test('admin can manage organizer but not admin roles', () => {
  const operator = {
    _id: 'openid_admin',
    roles: ['user', 'admin']
  };

  expect(getEditableRoles(operator)).toEqual(['organizer']);
  expect(buildRoleControls(operator, { roles: ['user'] })).toEqual([
    { role: 'organizer', checked: false, disabled: false },
    { role: 'admin', checked: false, disabled: true }
  ]);
});

test('super admin can manage organizer and admin roles', () => {
  const operator = {
    _id: 'openid_root',
    roles: ['user', 'super_admin']
  };

  expect(getEditableRoles(operator)).toEqual(['organizer', 'admin']);
  expect(buildRoleControls(operator, { roles: ['user', 'admin'] })).toEqual([
    { role: 'organizer', checked: false, disabled: false },
    { role: 'admin', checked: true, disabled: false }
  ]);
});
