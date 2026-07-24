const listUsers = require('../../cloudfunctions/listUsers/index');

function matchesQuery(item, query) {
  if (!query) {
    return true;
  }

  return Object.entries(query).every(([key, expected]) => {
    if (expected && expected.gt !== undefined) {
      return String(item[key] || '') > String(expected.gt);
    }

    return item[key] === expected;
  });
}

function createCollectionQuery(source, state = {}) {
  const queryState = {
    query: null,
    order: [],
    limit: null,
    ...state
  };

  return {
    where(query) {
      return createCollectionQuery(source, { ...queryState, query });
    },
    orderBy(field, direction) {
      return createCollectionQuery(source, {
        ...queryState,
        order: queryState.order.concat({ field, direction })
      });
    },
    limit(count) {
      return createCollectionQuery(source, { ...queryState, limit: Number(count) || 0 });
    },
    async get() {
      let data = source.filter(item => matchesQuery(item, queryState.query));

      queryState.order.forEach(({ field, direction }) => {
        data = data.slice().sort((left, right) => {
          const result = String(left[field] || '').localeCompare(String(right[field] || ''));
          return direction === 'desc' ? -result : result;
        });
      });

      data = data.slice(0, queryState.limit === null ? 100 : queryState.limit);

      return { data };
    }
  };
}

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
        managerAlias: 'Left-footed keeper',
        roles: ['user'],
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: '2026-05-03T00:00:00.000Z',
        lastActiveAt: '2026-05-13T00:00:00.000Z'
      },
      ...(options.users || {})
    },
    registrations: options.registrations || {}
  };

  return {
    state,
    command: {
      gt(value) {
        return { gt: value };
      }
    },
    collection(name) {
      const source = Object.values(state[name] || {});
      const query = createCollectionQuery(source);

      return {
        ...query,
        doc(id) {
          return {
            async get() {
              return { data: state[name][id] || null };
            }
          };
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

  expect(result).toMatchObject({
    items: [
      {
        _id: 'openid_organizer',
        preferredName: 'Organizer Zhang',
        displayName: 'Zhang San',
        nickName: '',
        avatarUrl: '',
        managerAlias: '',
        roles: ['user', 'organizer'],
        createdAt: '2026-05-02T00:00:00.000Z',
        lastActiveAt: '2026-05-12T00:00:00.000Z'
      }
    ],
    total: 1,
    limit: 20,
    skip: 0,
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

test('listUsers returns and searches manager aliases', async () => {
  const db = createFakeDb();

  const result = await listUsers.main(
    { keyword: 'keeper', limit: 20, skip: 0 },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(result).toMatchObject({
    items: [
      expect.objectContaining({
        _id: 'openid_player',
        preferredName: 'Player Li',
        managerAlias: 'Left-footed keeper'
      })
    ],
    total: 1,
    limit: 20,
    skip: 0,
    hasMore: false
  });
});

test('listUsers exposes legacy avatar fields as avatarUrl', async () => {
  const db = createFakeDb({
    users: {
      openid_legacy_avatar: {
        _id: 'openid_legacy_avatar',
        preferredName: 'Legacy Avatar',
        avatarURL: 'cloud://test-env/user-avatars/legacy.jpg',
        roles: ['user'],
        createdAt: '2026-05-04T00:00:00.000Z',
        lastActiveAt: '2026-05-14T00:00:00.000Z'
      }
    }
  });

  const result = await listUsers.main(
    { keyword: 'legacy', limit: 20, skip: 0 },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(result.items).toEqual([
    expect.objectContaining({
      _id: 'openid_legacy_avatar',
      avatarUrl: 'cloud://test-env/user-avatars/legacy.jpg'
    })
  ]);
});

test('listUsers falls back to the latest real registration avatar', async () => {
  const db = createFakeDb({
    users: {
      openid_profile_without_avatar: {
        _id: 'openid_profile_without_avatar',
        preferredName: 'No Avatar Profile',
        avatarUrl: '',
        roles: ['user'],
        createdAt: '2026-05-05T00:00:00.000Z',
        lastActiveAt: '2026-05-15T00:00:00.000Z'
      }
    },
    registrations: {
      old_registration: {
        _id: 'old_registration',
        userOpenId: 'openid_profile_without_avatar',
        proxyRegistration: false,
        avatarUrl: 'cloud://test-env/user-avatars/old.jpg',
        joinedAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z'
      },
      latest_registration: {
        _id: 'latest_registration',
        userOpenId: 'openid_profile_without_avatar',
        proxyRegistration: false,
        avatarUrl: 'cloud://test-env/user-avatars/latest.jpg',
        joinedAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-12T00:00:00.000Z'
      },
      proxy_registration: {
        _id: 'proxy_registration',
        userOpenId: 'openid_profile_without_avatar',
        proxyRegistration: true,
        avatarUrl: 'cloud://test-env/user-avatars/proxy.jpg',
        joinedAt: '2026-05-13T00:00:00.000Z',
        updatedAt: '2026-05-13T00:00:00.000Z'
      }
    }
  });

  const result = await listUsers.main(
    { keyword: 'No Avatar', limit: 20, skip: 0 },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(result.items).toEqual([
    expect.objectContaining({
      _id: 'openid_profile_without_avatar',
      avatarUrl: 'cloud://test-env/user-avatars/latest.jpg'
    })
  ]);
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

test('listUsers reads all cursor batches before filtering and paginating with exact metadata', async () => {
  const bulkUsers = Object.fromEntries(
    Array.from({ length: 125 }, (_, index) => {
      const id = `bulk_user_${String(index).padStart(3, '0')}`;
      return [id, {
        _id: id,
        preferredName: `Bulk User ${index}`,
        roles: ['user'],
        createdAt: '2026-06-01T00:00:00.000Z',
        lastActiveAt: '2026-06-02T00:00:00.000Z'
      }];
    })
  );
  const registrations = Object.fromEntries(
    Array.from({ length: 125 }, (_, index) => {
      const suffix = String(index).padStart(3, '0');
      return [`registration_${suffix}`, {
        _id: `registration_${suffix}`,
        userOpenId: `bulk_user_${suffix}`,
        avatarUrl: `cloud://test-env/user-avatars/${suffix}.jpg`,
        updatedAt: '2026-06-03T00:00:00.000Z'
      }];
    })
  );
  const db = createFakeDb({ users: bulkUsers, registrations });

  const result = await listUsers.main(
    { keyword: 'bulk', role: 'user', limit: 20, skip: 20 },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(result).toMatchObject({
    total: 125,
    limit: 20,
    skip: 20,
    hasMore: true
  });
  expect(result.items).toHaveLength(20);
  expect(result.items.map(item => item._id)).toEqual([
    'bulk_user_020',
    'bulk_user_021',
    'bulk_user_022',
    'bulk_user_023',
    'bulk_user_024',
    'bulk_user_025',
    'bulk_user_026',
    'bulk_user_027',
    'bulk_user_028',
    'bulk_user_029',
    'bulk_user_030',
    'bulk_user_031',
    'bulk_user_032',
    'bulk_user_033',
    'bulk_user_034',
    'bulk_user_035',
    'bulk_user_036',
    'bulk_user_037',
    'bulk_user_038',
    'bulk_user_039'
  ]);
  expect(result.items[0].avatarUrl).toBe('cloud://test-env/user-avatars/020.jpg');
});
