const updateUserManagerAlias = require('../../cloudfunctions/updateUserManagerAlias/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_admin: {
        _id: 'openid_admin',
        roles: ['user', 'admin']
      },
      openid_organizer: {
        _id: 'openid_organizer',
        roles: ['user', 'organizer']
      },
      openid_player: {
        _id: 'openid_player',
        preferredName: 'Player Li',
        managerAlias: 'Old Alias',
        roles: ['user']
      },
      ...(options.users || {})
    },
    activity_logs: []
  };

  return {
    state,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              return { data: state[name][id] || null };
            },
            async update({ data }) {
              state[name][id] = {
                ...(state[name][id] || {}),
                ...data
              };
              return {};
            }
          };
        },
        async add({ data }) {
          state[name].push(data);
          return { _id: `${name}_${state[name].length}` };
        }
      };
    }
  };
}

test('updateUserManagerAlias lets admins update the user-level manager alias', async () => {
  const db = createFakeDb();

  const result = await updateUserManagerAlias.main(
    { targetOpenId: 'openid_player', managerAlias: '  Left foot  ' },
    { OPENID: 'openid_admin' },
    { db, now: () => new Date('2026-06-17T10:00:00.000Z') }
  );

  expect(result).toEqual({
    user: expect.objectContaining({
      _id: 'openid_player',
      preferredName: 'Player Li',
      managerAlias: 'Left foot'
    })
  });
  expect(db.state.users.openid_player).toMatchObject({
    managerAlias: 'Left foot',
    managerAliasUpdatedAt: '2026-06-17T10:00:00.000Z',
    managerAliasUpdatedBy: 'openid_admin'
  });
  expect(db.state.activity_logs).toEqual([
    expect.objectContaining({
      action: 'manager_alias_update',
      operatorOpenId: 'openid_admin',
      targetOpenId: 'openid_player',
      before: { managerAlias: 'Old Alias' },
      after: { managerAlias: 'Left foot' }
    })
  ]);
});

test('updateUserManagerAlias rejects organizers', async () => {
  const db = createFakeDb();

  await expect(
    updateUserManagerAlias.main(
      { targetOpenId: 'openid_player', managerAlias: 'Hidden' },
      { OPENID: 'openid_organizer' },
      { db }
    )
  ).rejects.toThrow('Only admins can update user manager aliases');
});
