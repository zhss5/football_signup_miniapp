function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_player: {
        _id: 'openid_player',
        preferredName: 'Old Name',
        avatarUrl: 'cloud://old-avatar',
        profileSource: 'wechat',
        preferredPositions: ['前锋'],
        roles: ['user'],
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        status: 'published',
        startAt: '2026-07-21T12:00:00.000Z',
        signupDeadlineAt: '2026-07-21T08:00:00.000Z',
        joinedCount: 3,
        signupLimitTotal: 10
      },
      ...(options.activities || {})
    },
    registrations: {
      activity_1_openid_player: {
        _id: 'activity_1_openid_player',
        activityId: 'activity_1',
        teamId: 'team_green',
        userOpenId: 'openid_player',
        status: 'joined',
        signupName: 'Old Name',
        avatarUrl: 'cloud://old-avatar',
        profileSource: 'wechat',
        preferredPositions: ['前锋'],
        proxyRegistration: false,
        attendanceStatus: 'present',
        joinedAt: '2026-07-01T09:00:00.000Z',
        cancelCount: 1,
        removedCount: 0
      },
      ...(options.registrations || {})
    },
    activity_logs: []
  };

  function collection(name) {
    return {
      doc(id) {
        return {
          async get() {
            if (state[name] && state[name][id]) {
              return { data: state[name][id] };
            }
            if (options.throwOnMissing) {
              throw new Error('document not exists');
            }
            return { data: null };
          },
          async update({ data }) {
            state[name][id] = { ...state[name][id], ...data };
            return { updated: 1 };
          },
          async set({ data }) {
            state[name][id] = { _id: id, ...data };
            return { _id: id };
          }
        };
      },
      async add({ data }) {
        const id = `${name}_${state[name].length + 1}`;
        state[name].push({ _id: id, ...data });
        return { _id: id };
      }
    };
  }

  return {
    state,
    collection,
    runTransaction: callback => callback({ collection })
  };
}

const fixedNow = () => new Date('2026-07-21T09:00:00.000Z');

function loadSubject() {
  return require('../../cloudfunctions/updateMyRegistrationProfile/index');
}

test('updates the caller registration snapshot and reusable user defaults after signup closes', async () => {
  const db = createFakeDb();
  const updateMyRegistrationProfile = loadSubject();

  const result = await updateMyRegistrationProfile.main(
    {
      activityId: 'activity_1',
      signupName: '  New   Name  ',
      avatarUrl: 'cloud://new-avatar',
      profileSource: 'wechat',
      preferredPositions: ['中场', '边卫']
    },
    { OPENID: 'openid_player' },
    { db, now: fixedNow }
  );

  expect(result).toEqual({
    registrationId: 'activity_1_openid_player',
    activityId: 'activity_1',
    signupName: 'New Name',
    avatarUrl: 'cloud://new-avatar',
    profileSource: 'wechat',
    preferredPositions: ['中场', '边卫'],
    updatedAt: '2026-07-21T09:00:00.000Z'
  });
  expect(db.state.registrations.activity_1_openid_player).toMatchObject({
    signupName: 'New Name',
    avatarUrl: 'cloud://new-avatar',
    profileSource: 'wechat',
    preferredPositions: ['中场', '边卫'],
    updatedAt: '2026-07-21T09:00:00.000Z'
  });
  expect(db.state.users.openid_player).toMatchObject({
    preferredName: 'New Name',
    avatarUrl: 'cloud://new-avatar',
    profileSource: 'wechat',
    preferredPositions: ['中场', '边卫'],
    lastActiveAt: '2026-07-21T09:00:00.000Z',
    updatedAt: '2026-07-21T09:00:00.000Z'
  });
});

test('clears avatar explicitly and records manual profile source', async () => {
  const db = createFakeDb();
  const updateMyRegistrationProfile = loadSubject();

  const result = await updateMyRegistrationProfile.main(
    {
      activityId: 'activity_1',
      signupName: 'Player',
      avatarUrl: '   ',
      profileSource: 'wechat',
      preferredPositions: []
    },
    { OPENID: 'openid_player' },
    { db, now: fixedNow }
  );

  expect(result.avatarUrl).toBe('');
  expect(result.profileSource).toBe('manual');
  expect(db.state.registrations.activity_1_openid_player.avatarUrl).toBe('');
  expect(db.state.users.openid_player.avatarUrl).toBe('');
});

test('does not mutate registration identity, state, attendance, or counters', async () => {
  const db = createFakeDb();
  const before = { ...db.state.registrations.activity_1_openid_player };
  const updateMyRegistrationProfile = loadSubject();

  await updateMyRegistrationProfile.main(
    {
      activityId: 'activity_1',
      signupName: 'Player',
      avatarUrl: '',
      preferredPositions: ['门将']
    },
    { OPENID: 'openid_player' },
    { db, now: fixedNow }
  );

  expect(db.state.registrations.activity_1_openid_player).toMatchObject({
    activityId: before.activityId,
    teamId: before.teamId,
    userOpenId: before.userOpenId,
    status: before.status,
    attendanceStatus: before.attendanceStatus,
    joinedAt: before.joinedAt,
    cancelCount: before.cancelCount,
    removedCount: before.removedCount
  });
  expect(db.state.activities.activity_1).toEqual({
    _id: 'activity_1',
    status: 'published',
    startAt: '2026-07-21T12:00:00.000Z',
    signupDeadlineAt: '2026-07-21T08:00:00.000Z',
    joinedCount: 3,
    signupLimitTotal: 10
  });
});

test('writes registration_profile_update activity log with profile before and after snapshots', async () => {
  const db = createFakeDb();
  const updateMyRegistrationProfile = loadSubject();

  await updateMyRegistrationProfile.main(
    {
      activityId: 'activity_1',
      signupName: 'New Name',
      avatarUrl: '',
      preferredPositions: ['门将']
    },
    { OPENID: 'openid_player' },
    { db, now: fixedNow }
  );

  expect(db.state.activity_logs).toEqual([
    {
      _id: 'activity_logs_1',
      activityId: 'activity_1',
      action: 'registration_profile_update',
      operatorOpenId: 'openid_player',
      targetOpenId: 'openid_player',
      registrationId: 'activity_1_openid_player',
      before: {
        signupName: 'Old Name',
        avatarUrl: 'cloud://old-avatar',
        profileSource: 'wechat',
        preferredPositions: ['前锋']
      },
      after: {
        signupName: 'New Name',
        avatarUrl: '',
        profileSource: 'manual',
        preferredPositions: ['门将']
      },
      createdAt: '2026-07-21T09:00:00.000Z'
    }
  ]);
});

test('rejects editing once activity start time is reached', async () => {
  const db = createFakeDb();
  const updateMyRegistrationProfile = loadSubject();

  await expect(
    updateMyRegistrationProfile.main(
      {
        activityId: 'activity_1',
        signupName: 'Late Edit',
        avatarUrl: '',
        preferredPositions: []
      },
      { OPENID: 'openid_player' },
      { db, now: () => new Date('2026-07-21T12:00:00.000Z') }
    )
  ).rejects.toThrow('Registration profile is locked after activity start');
});

test('rejects a non-joined or proxy registration', async () => {
  const cancelledDb = createFakeDb({
    registrations: {
      activity_1_openid_player: {
        _id: 'activity_1_openid_player',
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        status: 'cancelled'
      }
    }
  });
  const proxyDb = createFakeDb({
    registrations: {
      activity_1_openid_player: {
        _id: 'activity_1_openid_player',
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        status: 'joined',
        proxyRegistration: true
      }
    }
  });
  const updateMyRegistrationProfile = loadSubject();
  const event = {
    activityId: 'activity_1',
    signupName: 'Player',
    avatarUrl: '',
    preferredPositions: []
  };

  await expect(
    updateMyRegistrationProfile.main(event, { OPENID: 'openid_player' }, { db: cancelledDb, now: fixedNow })
  ).rejects.toThrow('Only joined registrations can be edited');
  await expect(
    updateMyRegistrationProfile.main(event, { OPENID: 'openid_player' }, { db: proxyDb, now: fixedNow })
  ).rejects.toThrow('Proxy registrations cannot be edited');
});

test('derives ownership from trusted context and normalizes missing-document errors', async () => {
  const db = createFakeDb({ throwOnMissing: true });
  const updateMyRegistrationProfile = loadSubject();

  await expect(
    updateMyRegistrationProfile.main(
      {
        activityId: 'activity_1',
        targetOpenId: 'openid_player',
        signupName: 'Attacker',
        avatarUrl: '',
        preferredPositions: []
      },
      { OPENID: 'openid_attacker' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Registration not found');
  expect(db.state.registrations.activity_1_openid_player.signupName).toBe('Old Name');
});

test('validates signup name and stable preferred-position values', async () => {
  const db = createFakeDb();
  const updateMyRegistrationProfile = loadSubject();

  await expect(
    updateMyRegistrationProfile.main(
      { activityId: 'activity_1', signupName: '   ', avatarUrl: '', preferredPositions: [] },
      { OPENID: 'openid_player' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('signupName is required');
  await expect(
    updateMyRegistrationProfile.main(
      {
        activityId: 'activity_1',
        signupName: 'Player',
        avatarUrl: '',
        preferredPositions: ['守门员']
      },
      { OPENID: 'openid_player' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Unsupported preferred position');
  await expect(
    updateMyRegistrationProfile.main(
      {
        activityId: 'activity_1',
        signupName: 'Player',
        avatarUrl: '',
        preferredPositions: ['前锋', '中场', '门将']
      },
      { OPENID: 'openid_player' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('At most two preferred positions are allowed');
});
