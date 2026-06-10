const listNotificationLogs = require('../../cloudfunctions/listNotificationLogs/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_admin: { _id: 'openid_admin', roles: ['user', 'admin'] },
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
      openid_other: { _id: 'openid_other', roles: ['user', 'organizer'] },
      openid_player: { _id: 'openid_player', roles: ['user'] },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Owned Activity',
        organizerOpenId: 'openid_owner'
      },
      activity_2: {
        _id: 'activity_2',
        title: 'Other Activity',
        organizerOpenId: 'openid_other'
      },
      ...(options.activities || {})
    },
    notification_logs: {
      log_1: {
        _id: 'log_1',
        activityId: 'activity_1',
        notificationType: 'registration_joined',
        targetOpenId: 'openid_owner',
        status: 'sent',
        templateId: 'tmpl_1',
        createdAt: '2026-06-10T10:00:00.000Z'
      },
      log_2: {
        _id: 'log_2',
        activityId: 'activity_2',
        notificationType: 'cancelled',
        targetOpenId: 'openid_player',
        status: 'failed',
        errorMessage: 'quota exceeded',
        createdAt: '2026-06-10T11:00:00.000Z'
      },
      ...(options.notification_logs || {})
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

test('admin can list notification logs across activities', async () => {
  const result = await listNotificationLogs.main(
    { limit: 20 },
    { OPENID: 'openid_admin' },
    { db: createFakeDb() }
  );

  expect(result.items.map(item => item._id)).toEqual(['log_2', 'log_1']);
  expect(result.items[0]).toMatchObject({
    activityId: 'activity_2',
    notificationType: 'cancelled',
    status: 'failed',
    errorMessage: 'quota exceeded'
  });
});

test('organizer can list only notification logs for own activities', async () => {
  const result = await listNotificationLogs.main(
    {},
    { OPENID: 'openid_owner' },
    { db: createFakeDb() }
  );

  expect(result.items.map(item => item._id)).toEqual(['log_1']);

  await expect(
    listNotificationLogs.main(
      { activityId: 'activity_2' },
      { OPENID: 'openid_owner' },
      { db: createFakeDb() }
    )
  ).rejects.toThrow('Only the organizer or an admin can list notification logs');
});

test('regular users cannot list notification logs', async () => {
  await expect(
    listNotificationLogs.main({}, { OPENID: 'openid_player' }, { db: createFakeDb() })
  ).rejects.toThrow('Only organizers or admins can list notification logs');
});

test('listNotificationLogs supports filters and pagination', async () => {
  const result = await listNotificationLogs.main(
    {
      activityId: 'activity_2',
      notificationType: 'cancelled',
      status: 'failed',
      limit: 1,
      skip: 0
    },
    { OPENID: 'openid_admin' },
    { db: createFakeDb() }
  );

  expect(result).toMatchObject({
    items: [
      expect.objectContaining({
        _id: 'log_2'
      })
    ],
    hasMore: false
  });
});
