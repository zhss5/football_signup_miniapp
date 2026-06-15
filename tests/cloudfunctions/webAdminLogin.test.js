const createWebAdminLogin = require('../../cloudfunctions/createWebAdminLogin/index');
const confirmWebAdminLogin = require('../../cloudfunctions/confirmWebAdminLogin/index');
const pollWebAdminLogin = require('../../cloudfunctions/pollWebAdminLogin/index');

function createFakeDb(options = {}) {
  const state = {
    web_admin_sessions: {},
    users: {
      openid_root: {
        _id: 'openid_root',
        preferredName: 'Root',
        roles: ['user', 'super_admin']
      },
      openid_organizer: {
        _id: 'openid_organizer',
        preferredName: 'Organizer',
        roles: ['user', 'organizer']
      },
      openid_regular: {
        _id: 'openid_regular',
        preferredName: 'Regular',
        roles: ['user']
      }
    },
    ...(options.state || {})
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
            async set({ data }) {
              state[name][id] = { _id: id, ...data };
              return { _id: id };
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
        where(query) {
          return {
            limit() {
              return this;
            },
            async get() {
              const rows = Object.values(state[name] || {}).filter(row =>
                Object.keys(query || {}).every(key => row[key] === query[key])
              );
              return { data: rows };
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

function createTokenFactory(values) {
  const queue = values.slice();
  return () => queue.shift();
}

test('createWebAdminLogin creates a pending QR login challenge', async () => {
  const db = createFakeDb();

  const result = await createWebAdminLogin.main(
    {},
    {},
    {
      db,
      now: () => new Date('2026-06-15T10:00:00.000Z'),
      randomToken: createTokenFactory(['login_1', 'confirm_1', 'poll_1'])
    }
  );

  expect(result).toMatchObject({
    loginId: 'login_1',
    pollToken: 'poll_1',
    qrPayload: 'football-signup-web-admin-login:login_1:confirm_1',
    status: 'pending'
  });
  expect(db.state.web_admin_sessions.login_1).toMatchObject({
    status: 'pending',
    confirmToken: 'confirm_1',
    pollToken: 'poll_1',
    createdAt: '2026-06-15T10:00:00.000Z'
  });
});

test('confirmWebAdminLogin rejects regular users and confirms organizer/admin users', async () => {
  const db = createFakeDb();
  await createWebAdminLogin.main(
    {},
    {},
    {
      db,
      now: () => new Date('2026-06-15T10:00:00.000Z'),
      randomToken: createTokenFactory(['login_1', 'confirm_1', 'poll_1'])
    }
  );

  await expect(
    confirmWebAdminLogin.main(
      { qrPayload: 'football-signup-web-admin-login:login_1:confirm_1' },
      { OPENID: 'openid_regular' },
      { db, now: () => new Date('2026-06-15T10:01:00.000Z') }
    )
  ).rejects.toThrow('Only organizers or admins can confirm web admin login');

  const result = await confirmWebAdminLogin.main(
    { qrPayload: 'football-signup-web-admin-login:login_1:confirm_1' },
    { OPENID: 'openid_organizer' },
    {
      db,
      now: () => new Date('2026-06-15T10:02:00.000Z'),
      randomToken: createTokenFactory(['session_1'])
    }
  );

  expect(result).toEqual({ ok: true, status: 'confirmed' });
  expect(db.state.web_admin_sessions.login_1).toMatchObject({
    status: 'confirmed',
    confirmedOpenId: 'openid_organizer',
    sessionToken: 'session_1',
    confirmedAt: '2026-06-15T10:02:00.000Z'
  });
});

test('pollWebAdminLogin returns pending then returns a session for the confirmed WeChat user', async () => {
  const db = createFakeDb();
  await createWebAdminLogin.main(
    {},
    {},
    {
      db,
      now: () => new Date('2026-06-15T10:00:00.000Z'),
      randomToken: createTokenFactory(['login_1', 'confirm_1', 'poll_1'])
    }
  );

  await expect(
    pollWebAdminLogin.main(
      { loginId: 'login_1', pollToken: 'poll_1' },
      {},
      { db, now: () => new Date('2026-06-15T10:01:00.000Z') }
    )
  ).resolves.toEqual({ status: 'pending' });

  await confirmWebAdminLogin.main(
    { qrPayload: 'football-signup-web-admin-login:login_1:confirm_1' },
    { OPENID: 'openid_root' },
    {
      db,
      now: () => new Date('2026-06-15T10:02:00.000Z'),
      randomToken: createTokenFactory(['session_1'])
    }
  );

  const result = await pollWebAdminLogin.main(
    { loginId: 'login_1', pollToken: 'poll_1' },
    {},
    { db, now: () => new Date('2026-06-15T10:03:00.000Z') }
  );

  expect(result).toMatchObject({
    status: 'confirmed',
    webAdminSessionToken: 'session_1',
    user: {
      _id: 'openid_root',
      roles: ['user', 'super_admin']
    }
  });
});
