const listUsers = require('../../cloudfunctions/listUsers/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_root: {
        _id: 'openid_root',
        preferredName: 'Root',
        roles: ['user', 'super_admin'],
        createdAt: '2026-05-01T00:00:00.000Z',
        lastActiveAt: '2026-05-10T00:00:00.000Z'
      },
      openid_admin: {
        _id: 'openid_admin',
        preferredName: 'Admin',
        roles: ['user', 'admin'],
        createdAt: '2026-05-01T00:00:00.000Z',
        lastActiveAt: '2026-05-11T00:00:00.000Z'
      },
      openid_organizer: {
        _id: 'openid_organizer',
        preferredName: 'Organizer Zhang',
        displayName: 'Zhang San',
        roles: ['user', 'organizer'],
        createdAt: '2026-05-02T00:00:00.000Z',
        lastActiveAt: '2026-05-12T00:00:00.000Z'
      },
      openid_player: {
        _id: 'openid_player',
        preferredName: 'Player Li',
        nickName: 'Li Si',
        roles: ['user'],
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: '2026-05-03T00:00:00.000Z',
        lastActiveAt: '2026-05-13T00:00:00.000Z'
      },
      ...(options.users || {})
    }
  };

  return {
    state,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              return { data: state[name][id] || null };
            }
          };
        },
        async get() {
          return { data: Object.values(state[name] || {}) };
        }
      };
    }
  };
}

test('listUsers rejects regular users', async () => {
  const db = createFakeDb();

  await expect(
    listUsers.main({ keyword: 'li' }, { OPENID: 'openid_player' }, { db })
  ).rejects.toThrow('Only admins can list users');
});

test('listUsers rejects organizer users', async () => {
  const db = createFakeDb();

  await expect(
    listUsers.main({ keyword: 'zhang' }, { OPENID: 'openid_organizer' }, { db })
  ).rejects.toThrow('Only admins can list users');
});

test('listUsers lets admin search users by keyword and role', async () => {
  const db = createFakeDb();

  const result = await listUsers.main(
    { keyword: 'zhang', role: 'organizer', limit: 20, skip: 0 },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(result).toEqual({
    items: [
      {
        _id: 'openid_organizer',
        preferredName: 'Organizer Zhang',
        displayName: 'Zhang San',
        nickName: '',
        avatarUrl: '',
        roles: ['user', 'organizer'],
        createdAt: '2026-05-02T00:00:00.000Z',
        lastActiveAt: '2026-05-12T00:00:00.000Z'
      }
    ],
    hasMore: false
  });
});

test('listUsers supports openid search and pagination', async () => {
  const db = createFakeDb();

  const result = await listUsers.main(
    { keyword: 'openid_', limit: 2, skip: 1 },
    { OPENID: 'openid_root' },
    { db }
  );

  expect(result.items.map(item => item._id)).toEqual(['openid_admin', 'openid_organizer']);
  expect(result.hasMore).toBe(true);
});

test('listUsers accepts a web admin session token for a WeChat super admin', async () => {
  const db = createFakeDb({
    users: {
      openid_root: {
        _id: 'openid_root',
        preferredName: 'Root',
        roles: ['user', 'super_admin'],
        createdAt: '2026-05-01T00:00:00.000Z',
        lastActiveAt: '2026-05-14T00:00:00.000Z'
      }
    }
  });
  db._resolveWebAdminSessionToken = jest.fn(async token => {
    if (token === 'session_root') {
      return 'openid_root';
    }

    return '';
  });

  await expect(
    listUsers.main(
      { keyword: 'openid_player', limit: 20, skip: 0, webAdminSessionToken: 'session_root' },
      {},
      { db, getWXContext: () => ({}) }
    )
  ).resolves.toMatchObject({
    items: [
      expect.objectContaining({
        _id: 'openid_player'
      })
    ]
  });
});
