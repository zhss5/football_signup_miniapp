const updateParticipantManagerAlias = require('../../cloudfunctions/updateParticipantManagerAlias/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
      openid_other_owner: { _id: 'openid_other_owner', roles: ['user', 'organizer'] },
      openid_admin: { _id: 'openid_admin', roles: ['user', 'admin'] },
      openid_super: { _id: 'openid_super', roles: ['user', 'super_admin'] },
      openid_regular: { _id: 'openid_regular', roles: ['user'] },
      openid_player: {
        _id: 'openid_player',
        roles: ['user'],
        preferredName: 'Player',
        managerAlias: 'Old Alias'
      },
      openid_other_player: {
        _id: 'openid_other_player',
        roles: ['user'],
        preferredName: 'Other Player',
        managerAlias: ''
      },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Sunday Match',
        organizerOpenId: 'openid_owner',
        status: 'published'
      },
      activity_other: {
        _id: 'activity_other',
        title: 'Other Match',
        organizerOpenId: 'openid_other_owner',
        status: 'published'
      },
      ...(options.activities || {})
    },
    registrations: {
      reg_player: {
        _id: 'reg_player',
        activityId: 'activity_1',
        teamId: 'team_green',
        userOpenId: 'openid_player',
        status: 'joined',
        signupName: 'Player',
        proxyRegistration: false
      },
      reg_other_player: {
        _id: 'reg_other_player',
        activityId: 'activity_other',
        teamId: 'team_other',
        userOpenId: 'openid_other_player',
        status: 'joined',
        signupName: 'Other Player',
        proxyRegistration: false
      },
      ...(options.registrations || {})
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

const fixedNow = () => new Date('2026-06-10T09:00:00.000Z');

test('organizer can update manager alias for a real user in their activity', async () => {
  const db = createFakeDb();

  const result = await updateParticipantManagerAlias.main(
    {
      activityId: 'activity_1',
      targetOpenId: 'openid_player',
      managerAlias: '  Zhang San  '
    },
    { OPENID: 'openid_owner' },
    { db, now: fixedNow }
  );

  expect(result.user).toMatchObject({
    _id: 'openid_player',
    managerAlias: 'Zhang San',
    managerAliasUpdatedAt: '2026-06-10T09:00:00.000Z',
    managerAliasUpdatedBy: 'openid_owner'
  });
  expect(db.state.users.openid_player.managerAlias).toBe('Zhang San');
});

test('admin and super_admin can update manager alias for another organizer activity', async () => {
  const adminDb = createFakeDb();
  const superDb = createFakeDb();

  const adminResult = await updateParticipantManagerAlias.main(
    {
      activityId: 'activity_other',
      targetOpenId: 'openid_other_player',
      managerAlias: 'Admin Alias'
    },
    { OPENID: 'openid_admin' },
    { db: adminDb, now: fixedNow }
  );
  const superResult = await updateParticipantManagerAlias.main(
    {
      activityId: 'activity_other',
      targetOpenId: 'openid_other_player',
      managerAlias: 'Super Alias'
    },
    { OPENID: 'openid_super' },
    { db: superDb, now: fixedNow }
  );

  expect(adminResult.user.managerAlias).toBe('Admin Alias');
  expect(superResult.user.managerAlias).toBe('Super Alias');
});

test('regular users cannot update manager aliases', async () => {
  const db = createFakeDb();

  await expect(
    updateParticipantManagerAlias.main(
      {
        activityId: 'activity_1',
        targetOpenId: 'openid_player',
        managerAlias: 'Hidden Alias'
      },
      { OPENID: 'openid_regular' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Only the organizer or an admin can update manager aliases');
});

test('organizer cannot update a player outside their own activity', async () => {
  const db = createFakeDb();

  await expect(
    updateParticipantManagerAlias.main(
      {
        activityId: 'activity_other',
        targetOpenId: 'openid_other_player',
        managerAlias: 'Wrong Organizer'
      },
      { OPENID: 'openid_owner' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Only the organizer or an admin can update manager aliases');
});

test('manager alias can be cleared with an empty string', async () => {
  const db = createFakeDb();

  const result = await updateParticipantManagerAlias.main(
    {
      activityId: 'activity_1',
      targetOpenId: 'openid_player',
      managerAlias: '   '
    },
    { OPENID: 'openid_owner' },
    { db, now: fixedNow }
  );

  expect(result.user.managerAlias).toBe('');
  expect(db.state.users.openid_player.managerAlias).toBe('');
});

test('manager alias accepts values up to 40 characters', async () => {
  const db = createFakeDb();
  const fortyChars = 'a'.repeat(40);

  const result = await updateParticipantManagerAlias.main(
    {
      activityId: 'activity_1',
      targetOpenId: 'openid_player',
      managerAlias: fortyChars
    },
    { OPENID: 'openid_owner' },
    { db, now: fixedNow }
  );

  expect(result.user.managerAlias).toBe(fortyChars);
  expect(db.state.users.openid_player.managerAlias).toBe(fortyChars);
});

test('manager alias rejects values longer than 40 characters', async () => {
  const db = createFakeDb();

  await expect(
    updateParticipantManagerAlias.main(
      {
        activityId: 'activity_1',
        targetOpenId: 'openid_player',
        managerAlias: 'a'.repeat(41)
      },
      { OPENID: 'openid_owner' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('managerAlias cannot exceed 40 characters');
});

test('manager alias only applies to real WeChat signup users', async () => {
  const db = createFakeDb({
    registrations: {
      reg_proxy: {
        _id: 'reg_proxy',
        activityId: 'activity_1',
        teamId: 'team_green',
        userOpenId: 'proxy_activity_1_1',
        status: 'joined',
        signupName: 'Proxy Player',
        proxyRegistration: true
      }
    }
  });

  await expect(
    updateParticipantManagerAlias.main(
      {
        activityId: 'activity_1',
        targetOpenId: 'proxy_activity_1_1',
        managerAlias: 'Proxy Alias'
      },
      { OPENID: 'openid_owner' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Manager aliases can only be set for real signup users');
});

test('manager alias update writes an activity log with before and after values', async () => {
  const db = createFakeDb();

  await updateParticipantManagerAlias.main(
    {
      activityId: 'activity_1',
      targetOpenId: 'openid_player',
      managerAlias: 'New Alias'
    },
    { OPENID: 'openid_owner' },
    { db, now: fixedNow }
  );

  expect(db.state.activity_logs).toEqual([
    {
      _id: 'activity_logs_1',
      activityId: 'activity_1',
      action: 'manager_alias_update',
      operatorOpenId: 'openid_owner',
      targetOpenId: 'openid_player',
      registrationId: 'reg_player',
      before: {
        managerAlias: 'Old Alias'
      },
      after: {
        managerAlias: 'New Alias'
      },
      createdAt: '2026-06-10T09:00:00.000Z'
    }
  ]);
});
