const listActivityLogs = require('../../cloudfunctions/listActivityLogs/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
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
    activity_logs: [
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
          if (Array.isArray(state[name])) {
            return { data: state[name] };
          }

          return { data: Object.values(state[name] || {}) };
        }
      };
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
