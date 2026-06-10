const {
  buildRoleUpdatePayload,
  buildSearchParams,
  buildUserRows
} = require('../../web-admin/src/user-management');

test('buildSearchParams keeps API-shaped listUsers filters', () => {
  expect(
    buildSearchParams({
      keyword: '  zhang  ',
      role: 'organizer',
      limit: '50',
      skip: '10'
    })
  ).toEqual({
    keyword: 'zhang',
    role: 'organizer',
    limit: 50,
    skip: 10
  });
});

test('buildUserRows exposes role controls using operator boundaries', () => {
  const rows = buildUserRows(
    [
      {
        _id: 'openid_player',
        preferredName: 'Player Li',
        roles: ['user']
      }
    ],
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    }
  );

  expect(rows).toEqual([
    {
      openid: 'openid_player',
      displayName: 'Player Li',
      rolesText: 'user',
      roleControls: [
        { role: 'organizer', checked: false, disabled: false },
        { role: 'admin', checked: false, disabled: true }
      ]
    }
  ]);
});

test('admin role update payload can only toggle organizer', () => {
  expect(
    buildRoleUpdatePayload(
      { roles: ['user', 'admin'] },
      { _id: 'openid_player', roles: ['user'] },
      { organizer: true }
    )
  ).toEqual({
    targetOpenId: 'openid_player',
    roles: ['user', 'organizer']
  });

  expect(() =>
    buildRoleUpdatePayload(
      { roles: ['user', 'admin'] },
      { _id: 'openid_player', roles: ['user'] },
      { admin: true }
    )
  ).toThrow('Only super admins can manage admin roles');
});

test('super admin role update payload can toggle organizer and admin', () => {
  expect(
    buildRoleUpdatePayload(
      { roles: ['user', 'super_admin'] },
      { _id: 'openid_player', roles: ['user', 'organizer'] },
      { organizer: false, admin: true }
    )
  ).toEqual({
    targetOpenId: 'openid_player',
    roles: ['user', 'admin']
  });
});
