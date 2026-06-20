jest.mock('wx-server-sdk', () => ({
  init: jest.fn(),
  DYNAMIC_CURRENT_ENV: 'test-env',
  getWXContext: jest.fn(() => ({ OPENID: 'openid_owner' })),
  database: jest.fn()
}));

const cloud = require('wx-server-sdk');
const listActivities = require('../../cloudfunctions/listActivities/index');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function matchesQuery(item, query) {
  if (!query) {
    return true;
  }

  return Object.entries(query).every(([key, expected]) => {
    if (expected && Array.isArray(expected.values)) {
      return expected.values.includes(item[key]);
    }

    return item[key] === expected;
  });
}

function compareValues(left, right, direction) {
  const leftText = String(left || '');
  const rightText = String(right || '');
  const result = leftText.localeCompare(rightText);
  return direction === 'desc' ? -result : result;
}

function createCollectionQuery(source, state = {}) {
  const queryState = {
    query: null,
    order: [],
    skip: 0,
    limit: null,
    ...state
  };

  return {
    where(query) {
      return createCollectionQuery(source, {
        ...queryState,
        query
      });
    },
    orderBy(field, direction) {
      return createCollectionQuery(source, {
        ...queryState,
        order: queryState.order.concat({ field, direction })
      });
    },
    skip(count) {
      return createCollectionQuery(source, {
        ...queryState,
        skip: Number(count) || 0
      });
    },
    limit(count) {
      return createCollectionQuery(source, {
        ...queryState,
        limit: Number(count) || 0
      });
    },
    async get() {
      let data = source.filter(item => matchesQuery(item, queryState.query));

      queryState.order.forEach(({ field, direction }) => {
        data = data.slice().sort((left, right) => compareValues(left[field], right[field], direction));
      });

      if (queryState.skip > 0) {
        data = data.slice(queryState.skip);
      }

      if (Number.isFinite(queryState.limit) && queryState.limit !== null) {
        data = data.slice(0, queryState.limit);
      }

      return { data: clone(data) };
    }
  };
}

function createFakeDb(collections) {
  return {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      const query = createCollectionQuery(collections[name] || []);

      return {
        ...query,
        doc(id) {
          return {
            async get() {
              return { data: (collections[name] || []).find(item => item._id === id) || null };
            }
          };
        }
      };
    }
  };
}

beforeEach(() => {
  cloud.database.mockReset();
});

test('created scope returns newest activities first and honors limit', async () => {
  cloud.database.mockReturnValue(
    createFakeDb({
      activities: [
        {
          _id: 'owned_old',
          organizerOpenId: 'openid_owner',
          startAt: '2026-05-01T20:00:00.000Z',
          status: 'published'
        },
        {
          _id: 'owned_new',
          organizerOpenId: 'openid_owner',
          startAt: '2026-05-03T20:00:00.000Z',
          status: 'published'
        },
        {
          _id: 'owned_middle',
          organizerOpenId: 'openid_owner',
          startAt: '2026-05-02T20:00:00.000Z',
          status: 'cancelled'
        },
        {
          _id: 'other_newer',
          organizerOpenId: 'openid_other',
          startAt: '2026-05-04T20:00:00.000Z',
          status: 'published'
        }
      ]
    })
  );

  const result = await listActivities.main(
    { scope: 'created', limit: 2 },
    { OPENID: 'openid_owner' }
  );

  expect(result.items.map(item => item._id)).toEqual(['owned_new', 'owned_middle']);
});

test('home scope returns newest visible activities first and honors limit', async () => {
  cloud.database.mockReturnValue(
    createFakeDb({
      activities: [
        {
          _id: 'published_old',
          startAt: '2026-05-01T20:00:00.000Z',
          status: 'published'
        },
        {
          _id: 'cancelled_new',
          startAt: '2026-05-03T20:00:00.000Z',
          status: 'cancelled'
        },
        {
          _id: 'deleted_newer',
          startAt: '2026-05-04T20:00:00.000Z',
          status: 'deleted'
        },
        {
          _id: 'published_middle',
          startAt: '2026-05-02T20:00:00.000Z',
          status: 'published'
        }
      ]
    })
  );

  const result = await listActivities.main({ scope: 'home', limit: 2 }, { OPENID: 'openid_user' });

  expect(result.items.map(item => item._id)).toEqual(['cancelled_new', 'published_middle']);
});

test('joined scope sorts activities after registration lookup and honors limit', async () => {
  cloud.database.mockReturnValue(
    createFakeDb({
      registrations: [
        {
          _id: 'reg_old',
          activityId: 'activity_old',
          userOpenId: 'openid_player',
          status: 'joined'
        },
        {
          _id: 'reg_new',
          activityId: 'activity_new',
          userOpenId: 'openid_player',
          status: 'joined'
        },
        {
          _id: 'reg_middle',
          activityId: 'activity_middle',
          userOpenId: 'openid_player',
          status: 'joined'
        },
        {
          _id: 'reg_deleted',
          activityId: 'activity_deleted',
          userOpenId: 'openid_player',
          status: 'joined'
        },
        {
          _id: 'reg_cancelled',
          activityId: 'activity_cancelled',
          userOpenId: 'openid_player',
          status: 'cancelled'
        }
      ],
      activities: [
        {
          _id: 'activity_old',
          startAt: '2026-05-01T20:00:00.000Z',
          status: 'published'
        },
        {
          _id: 'activity_middle',
          startAt: '2026-05-02T20:00:00.000Z',
          status: 'published'
        },
        {
          _id: 'activity_new',
          startAt: '2026-05-03T20:00:00.000Z',
          status: 'published'
        },
        {
          _id: 'activity_deleted',
          startAt: '2026-05-04T20:00:00.000Z',
          status: 'deleted'
        },
        {
          _id: 'activity_cancelled',
          startAt: '2026-05-05T20:00:00.000Z',
          status: 'published'
        }
      ]
    })
  );

  const result = await listActivities.main(
    { scope: 'joined', limit: 2 },
    { OPENID: 'openid_player' }
  );

  expect(result.items.map(item => item._id)).toEqual(['activity_new', 'activity_middle']);
});

test('web-admin scope lets admin filter activities by date status organizer and keyword', async () => {
  cloud.database.mockReturnValue(
    createFakeDb({
      users: [
        { _id: 'openid_admin', roles: ['user', 'admin'] },
        {
          _id: 'openid_owner',
          preferredName: 'Owner Zhang',
          displayName: 'Zhang San',
          managerAlias: 'Coach Zhang',
          roles: ['user', 'organizer']
        }
      ],
      activities: [
        {
          _id: 'activity_a',
          title: 'Monday Futsal',
          organizerOpenId: 'openid_owner',
          startAt: '2026-06-01T20:00:00.000Z',
          status: 'published'
        },
        {
          _id: 'activity_b',
          title: 'Friday Football',
          organizerOpenId: 'openid_owner',
          startAt: '2026-06-05T20:00:00.000Z',
          status: 'cancelled'
        },
        {
          _id: 'activity_c',
          title: 'Friday Football',
          organizerOpenId: 'openid_other',
          startAt: '2026-06-06T20:00:00.000Z',
          status: 'published'
        }
      ]
    })
  );

  const result = await listActivities.main(
    {
      scope: 'web-admin',
      keyword: 'football',
      status: 'cancelled',
      organizerOpenId: 'openid_owner',
      startAtFrom: '2026-06-01T00:00:00.000Z',
      startAtTo: '2026-06-05T23:59:59.999Z'
    },
    { OPENID: 'openid_admin' }
  );

  expect(result.items.map(item => item._id)).toEqual(['activity_b']);
  expect(result.items[0]).toMatchObject({
    organizerOpenId: 'openid_owner',
    organizerName: 'Owner Zhang',
    organizerManagerAlias: 'Coach Zhang'
  });
  expect(result.hasMore).toBe(false);
});

test('web-admin scope limits organizers to their own activities and rejects regular users', async () => {
  const db = createFakeDb({
    users: [
      { _id: 'openid_owner', roles: ['user', 'organizer'] },
      { _id: 'openid_player', roles: ['user'] }
    ],
    activities: [
      {
        _id: 'owned_activity',
        title: 'Owned',
        organizerOpenId: 'openid_owner',
        startAt: '2026-06-01T20:00:00.000Z',
        status: 'published'
      },
      {
        _id: 'other_activity',
        title: 'Other',
        organizerOpenId: 'openid_other',
        startAt: '2026-06-02T20:00:00.000Z',
        status: 'published'
      }
    ]
  });
  cloud.database.mockReturnValue(db);

  const result = await listActivities.main(
    { scope: 'web-admin' },
    { OPENID: 'openid_owner' }
  );

  expect(result.items.map(item => item._id)).toEqual(['owned_activity']);

  await expect(
    listActivities.main({ scope: 'web-admin' }, { OPENID: 'openid_player' })
  ).rejects.toThrow('Only organizers or admins can list web admin activities');
});
