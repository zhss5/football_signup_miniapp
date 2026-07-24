const listNotificationLogs = require('../../cloudfunctions/listNotificationLogs/index');

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

      return { data: data.slice(0, queryState.limit === null ? 100 : queryState.limit) };
    }
  };
}

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
    command: {
      gt(value) {
        return { gt: value };
      }
    },
    collection(name) {
      const query = createCollectionQuery(Object.values(state[name] || {}));

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

test('admin can list notification logs across activities', async () => {
  const result = await listNotificationLogs.main(
    { limit: 20 },
    { OPENID: 'openid_admin' },
    { db: createFakeDb() }
  );

  expect(result.items.map(item => item._id)).toEqual(['log_2', 'log_1']);
  expect(result.items[0]).toMatchObject({
    activityId: 'activity_2',
    activityTitle: 'Other Activity',
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

test('listNotificationLogs filters beyond the source cap and returns a stable second page with exact metadata', async () => {
  const notification_logs = Object.fromEntries(
    Array.from({ length: 100 }, (_, index) => {
      const id = `bulk_log_${String(index).padStart(3, '0')}`;
      return [id, {
        _id: id,
        activityId: 'activity_2',
        notificationType: 'registration_joined',
        status: 'sent',
        createdAt: '2026-07-01T10:00:00.000Z'
      }];
    })
  );

  Array.from({ length: 45 }, (_, index) => {
    const suffix = String(index).padStart(3, '0');
    notification_logs[`log_page_${suffix}`] = {
      _id: `log_page_${suffix}`,
      activityId: 'activity_1',
      notificationType: 'cancelled',
      status: 'failed',
      createdAt: '2026-07-02T10:00:00.000Z'
    };
  });

  const result = await listNotificationLogs.main(
    {
      activityId: 'activity_1',
      notificationType: 'cancelled',
      status: 'failed',
      skip: 20
    },
    { OPENID: 'openid_admin' },
    { db: createFakeDb({ notification_logs }) }
  );

  expect(result).toMatchObject({
    total: 45,
    limit: 20,
    skip: 20,
    hasMore: true
  });
  expect(result.items).toHaveLength(20);
  expect(result.items.map(item => item._id)).toEqual(
    Array.from({ length: 20 }, (_, index) => `log_page_${String(24 - index).padStart(3, '0')}`)
  );
});
