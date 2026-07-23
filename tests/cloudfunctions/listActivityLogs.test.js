const listActivityLogs = require('../../cloudfunctions/listActivityLogs/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_owner: {
        _id: 'openid_owner',
        preferredName: 'Owner Zhang',
        managerAlias: '队长张',
        roles: ['user', 'organizer']
      },
      openid_player: {
        _id: 'openid_player',
        preferredName: 'Alex User',
        managerAlias: '左脚'
      },
      openid_other_owner: { _id: 'openid_other_owner', roles: ['user', 'organizer'] },
      openid_admin: { _id: 'openid_admin', roles: ['user', 'admin'] },
      openid_super: { _id: 'openid_super', roles: ['user', 'super_admin'] },
      openid_regular: { _id: 'openid_regular', roles: ['user'] },
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
    activity_teams: {
      team_green: {
        _id: 'team_green',
        activityId: 'activity_1',
        teamName: 'Green'
      },
      team_red: {
        _id: 'team_red',
        activityId: 'activity_1',
        teamName: 'Red'
      },
      team_other: {
        _id: 'team_other',
        activityId: 'activity_other',
        teamName: 'Other'
      },
      ...(options.activity_teams || {})
    },
    registrations: {
      reg_1: {
        _id: 'reg_1',
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        signupName: 'Alex',
        teamId: 'team_green',
        status: 'joined'
      },
      reg_other: {
        _id: 'reg_other',
        activityId: 'activity_other',
        userOpenId: 'openid_other_player',
        signupName: 'Ben',
        teamId: 'team_other',
        status: 'joined'
      },
      ...(options.registrations || {})
    },
    activity_logs: [
      ...(options.activity_logs_prefix || []),
      {
        _id: 'log_1',
        activityId: 'activity_1',
        action: 'signup_joined',
        operatorOpenId: 'openid_player',
        targetOpenId: 'openid_player',
        registrationId: 'reg_1',
        teamId: 'team_green',
        createdAt: '2026-06-10T09:00:00.000Z'
      },
      {
        _id: 'log_2',
        activityId: 'activity_1',
        action: 'manager_alias_update',
        operatorOpenId: 'openid_owner',
        targetOpenId: 'openid_player',
        registrationId: 'reg_1',
        before: { managerAlias: '' },
        after: { managerAlias: 'Zhang San' },
        createdAt: '2026-06-10T10:00:00.000Z'
      },
      {
        _id: 'log_3',
        activityId: 'activity_other',
        action: 'registration_removed',
        operatorOpenId: 'openid_other_owner',
        targetOpenId: 'openid_other_player',
        registrationId: 'reg_other',
        teamId: 'team_other',
        createdAt: '2026-06-10T11:00:00.000Z'
      },
      ...(options.activity_logs || [])
    ]
  };

  const queryCalls = [];

  function createCollectionQuery(name, criteria = null, querySkip = 0, queryLimit = 100) {
    return {
      doc(id) {
        return {
          async get() {
            return { data: state[name][id] || null };
          }
        };
      },
      where(nextCriteria) {
        queryCalls.push({ collection: name, criteria: nextCriteria });
        return createCollectionQuery(name, nextCriteria, querySkip, queryLimit);
      },
      skip(value) {
        return createCollectionQuery(name, criteria, value, queryLimit);
      },
      limit(value) {
        return createCollectionQuery(name, criteria, querySkip, value);
      },
      async get() {
        const source = Array.isArray(state[name])
          ? state[name]
          : Object.values(state[name] || {});
        const filtered = criteria
          ? source.filter(item =>
              Object.entries(criteria).every(([key, value]) => item && item[key] === value)
            )
          : source;

        return { data: filtered.slice(querySkip, querySkip + queryLimit) };
      }
    };
  }

  return {
    state,
    queryCalls,
    collection(name) {
      return createCollectionQuery(name);
    }
  };
}

test('admin can list activity logs across activities ordered newest first', async () => {
  const db = createFakeDb();

  const result = await listActivityLogs.main(
    { limit: 10 },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(result.items.map(item => item._id)).toEqual(['log_3', 'log_2', 'log_1']);
  expect(result.hasMore).toBe(false);
});

test('listActivityLogs enriches rows with participant and team display names', async () => {
  const db = createFakeDb({
    activity_logs: [
      {
        _id: 'log_move',
        activityId: 'activity_1',
        action: 'registration_moved',
        operatorOpenId: 'openid_owner',
        targetOpenId: 'openid_player',
        registrationId: 'reg_1',
        fromTeamId: 'team_green',
        toTeamId: 'team_red',
        createdAt: '2026-06-10T12:00:00.000Z'
      }
    ]
  });

  const result = await listActivityLogs.main(
    { activityId: 'activity_1', action: 'registration_moved' },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(result.items).toEqual([
    expect.objectContaining({
      _id: 'log_move',
      operatorName: 'Owner Zhang',
      operatorManagerAlias: '队长张',
      targetName: 'Alex',
      targetManagerAlias: '左脚',
      teamName: 'Green',
      fromTeamName: 'Green',
      toTeamName: 'Red'
    })
  ]);
});

test('listActivityLogs preserves attendance status for attendance updates', async () => {
  const db = createFakeDb({
    activity_logs: [
      {
        _id: 'log_absent',
        activityId: 'activity_1',
        action: 'attendance_update',
        operatorOpenId: 'openid_owner',
        userOpenId: 'openid_player',
        registrationId: 'reg_1',
        attendanceStatus: 'absent',
        createdAt: '2026-06-10T12:00:00.000Z'
      }
    ]
  });

  const result = await listActivityLogs.main(
    { activityId: 'activity_1', action: 'attendance_update' },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(result.items).toEqual([
    expect.objectContaining({
      _id: 'log_absent',
      action: 'attendance_update',
      attendanceStatus: 'absent'
    })
  ]);
});

test('super_admin can filter activity logs by action', async () => {
  const db = createFakeDb();

  const result = await listActivityLogs.main(
    { action: 'manager_alias_update' },
    { OPENID: 'openid_super' },
    { db }
  );

  expect(result.items).toEqual([
    expect.objectContaining({
      _id: 'log_2',
      activityId: 'activity_1',
      action: 'manager_alias_update',
      before: { managerAlias: '' },
      after: { managerAlias: 'Zhang San' }
    })
  ]);
  expect(db.queryCalls).toContainEqual({
    collection: 'activity_logs',
    criteria: { action: 'manager_alias_update' }
  });
});

test('organizer can list logs only for their own activities', async () => {
  const db = createFakeDb();

  const result = await listActivityLogs.main(
    { limit: 10 },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(result.items.map(item => item._id)).toEqual(['log_2', 'log_1']);
});

test('organizer cannot list logs for another organizer activity', async () => {
  const db = createFakeDb();

  await expect(
    listActivityLogs.main(
      { activityId: 'activity_other' },
      { OPENID: 'openid_owner' },
      { db }
    )
  ).rejects.toThrow('Only the organizer or an admin can list activity logs');
});

test('regular users cannot list activity logs', async () => {
  const db = createFakeDb();

  await expect(
    listActivityLogs.main({ activityId: 'activity_1' }, { OPENID: 'openid_regular' }, { db })
  ).rejects.toThrow('Only the organizer or an admin can list activity logs');
});

test('listActivityLogs supports pagination with hasMore', async () => {
  const db = createFakeDb();

  const result = await listActivityLogs.main(
    { limit: 1, skip: 1 },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(result.items.map(item => item._id)).toEqual(['log_2']);
  expect(result.hasMore).toBe(true);
});

test('activity detail filters logs in the database before the collection read limit', async () => {
  const olderOtherActivityLogs = Array.from({ length: 100 }, (_, index) => ({
    _id: `old_other_${index}`,
    activityId: 'activity_other',
    action: 'signup_joined',
    operatorOpenId: 'openid_other_owner',
    targetOpenId: `openid_other_${index}`,
    createdAt: `2026-06-01T00:${String(index % 60).padStart(2, '0')}:00.000Z`
  }));
  const db = createFakeDb({
    activity_logs_prefix: olderOtherActivityLogs
  });

  const result = await listActivityLogs.main(
    { activityId: 'activity_1', limit: 10 },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(result.items.map(item => item._id)).toEqual(['log_2', 'log_1']);
  expect(db.queryCalls).toContainEqual({
    collection: 'activity_logs',
    criteria: { activityId: 'activity_1' }
  });
});

test('target filtering queries current and legacy activity log identity fields', async () => {
  const db = createFakeDb({
    activity_logs: [
      {
        _id: 'log_legacy_target',
        activityId: 'activity_1',
        action: 'attendance_update',
        operatorOpenId: 'openid_owner',
        userOpenId: 'openid_player',
        registrationId: 'reg_1',
        createdAt: '2026-06-10T13:00:00.000Z'
      }
    ]
  });

  const result = await listActivityLogs.main(
    { activityId: 'activity_1', targetOpenId: 'openid_player' },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(result.items.map(item => item._id)).toEqual([
    'log_legacy_target',
    'log_2',
    'log_1'
  ]);
  expect(db.queryCalls).toEqual(
    expect.arrayContaining([
      {
        collection: 'activity_logs',
        criteria: {
          activityId: 'activity_1',
          targetOpenId: 'openid_player'
        }
      },
      {
        collection: 'activity_logs',
        criteria: {
          activityId: 'activity_1',
          userOpenId: 'openid_player'
        }
      }
    ])
  );
});
