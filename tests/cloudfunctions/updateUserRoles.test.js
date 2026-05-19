const updateUserRoles = require('../../cloudfunctions/updateUserRoles/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_root: {
        _id: 'openid_root',
        preferredName: 'Root',
        roles: ['user', 'super_admin']
      },
      openid_admin: {
        _id: 'openid_admin',
        preferredName: 'Admin',
        roles: ['user', 'admin']
      },
      openid_player: {
        _id: 'openid_player',
        preferredName: 'Player',
        roles: ['user']
      },
      ...(options.users || {})
    },
    user_role_logs: []
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
                ...state[name][id],
                ...data
              };
              return { updated: 1 };
            }
          };
        },
        async get() {
          if (Array.isArray(state[name])) {
            return { data: state[name] };
          }

          return { data: Object.values(state[name] || {}) };
        },
        async add({ data }) {
          const id = `${name}_${state[name].length + 1}`;
          state[name].push({ _id: id, ...data });
          return { _id: id };
        }
      };
    }
  };
}

const fixedNow = () => new Date('2026-05-19T00:00:00.000Z');

test('super_admin can grant admin to a regular user', async () => {
  const db = createFakeDb();

  const result = await updateUserRoles.main(
    { targetOpenId: 'openid_player', roles: ['user', 'admin'] },
    { OPENID: 'openid_root' },
    { db, now: fixedNow }
  );

  expect(result.user.roles).toEqual(['user', 'admin']);
  expect(db.state.users.openid_player.roles).toEqual(['user', 'admin']);
});

test('admin can grant organizer but cannot grant admin', async () => {
  const db = createFakeDb();

  const result = await updateUserRoles.main(
    { targetOpenId: 'openid_player', roles: ['user', 'organizer'] },
    { OPENID: 'openid_admin' },
    { db, now: fixedNow }
  );

  expect(result.user.roles).toEqual(['user', 'organizer']);

  await expect(
    updateUserRoles.main(
      { targetOpenId: 'openid_player', roles: ['user', 'admin'] },
      { OPENID: 'openid_admin' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Only super admins can manage admin roles');
});

test('role removal keeps base user role', async () => {
  const db = createFakeDb({
    users: {
      openid_target: {
        _id: 'openid_target',
        preferredName: 'Target',
        roles: ['user', 'organizer']
      }
    }
  });

  const result = await updateUserRoles.main(
    { targetOpenId: 'openid_target', roles: [] },
    { OPENID: 'openid_admin' },
    { db, now: fixedNow }
  );

  expect(result.user.roles).toEqual(['user']);
  expect(db.state.users.openid_target.roles).toEqual(['user']);
});

test('cannot remove the last super_admin', async () => {
  const db = createFakeDb();

  await expect(
    updateUserRoles.main(
      { targetOpenId: 'openid_root', roles: ['user', 'admin'] },
      { OPENID: 'openid_root' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Cannot remove the last super admin');
});

test('role changes write an audit log', async () => {
  const db = createFakeDb();

  await updateUserRoles.main(
    { targetOpenId: 'openid_player', roles: ['user', 'organizer'] },
    { OPENID: 'openid_admin' },
    { db, now: fixedNow }
  );

  expect(db.state.user_role_logs).toEqual([
    {
      _id: 'user_role_logs_1',
      action: 'update_user_roles',
      operatorOpenId: 'openid_admin',
      targetOpenId: 'openid_player',
      previousRoles: ['user'],
      nextRoles: ['user', 'organizer'],
      createdAt: '2026-05-19T00:00:00.000Z'
    }
  ]);
});
