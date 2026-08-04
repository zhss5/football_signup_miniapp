jest.mock('wx-server-sdk', () => ({
  init: jest.fn(),
  DYNAMIC_CURRENT_ENV: 'test-env',
  getWXContext: jest.fn(() => ({ OPENID: 'openid_owner' })),
  database: jest.fn()
}));

const cloud = require('wx-server-sdk');
const getActivityStats = require('../../cloudfunctions/getActivityStats/index');

function createQuery(source, criteria = {}, state = {}) {
  const queryState = { order: null, limit: 100, ...state };

  return {
    where(nextCriteria) {
      return createQuery(source, { ...criteria, ...nextCriteria }, queryState);
    },
    orderBy(field, direction) {
      return createQuery(source, criteria, {
        ...queryState,
        order: { field, direction }
      });
    },
    limit(value) {
      return createQuery(source, criteria, { ...queryState, limit: value });
    },
    async get() {
      let data = source.filter(item =>
        Object.entries(criteria).every(([key, expected]) => {
          if (expected && expected.gt !== undefined) {
            return String(item[key] || '') > String(expected.gt);
          }
          return item[key] === expected;
        })
      );

      if (queryState.order) {
        const { field, direction } = queryState.order;
        data = data.slice().sort((left, right) => {
          const result = String(left[field] || '').localeCompare(String(right[field] || ''));
          return direction === 'desc' ? -result : result;
        });
      }

      return { data: data.slice(0, queryState.limit) };
    }
  };
}

function createFakeDb(collections) {
  return {
    command: {
      gt(value) {
        return { gt: value };
      }
    },
    collection(name) {
      const source = collections[name] || [];
      return {
        ...createQuery(source),
        doc(id) {
          return {
            async get() {
              return { data: source.find(item => item._id === id) || null };
            }
          };
        }
      };
    }
  };
}

test('getActivityStats rejects non-organizer', async () => {
  await expect(
    getActivityStats.main(
      { activityId: 'activity_1' },
      { OPENID: 'openid_user' },
      {
        loadActivity: async () => ({ organizerOpenId: 'openid_owner' })
      }
    )
  ).rejects.toThrow('Not allowed to view activity stats');
});

test('getActivityStats includes registrations beyond the first query page', async () => {
  const registrations = Array.from({ length: 105 }, (_, index) => ({
    _id: `reg_${String(index).padStart(3, '0')}`,
    activityId: 'activity_1',
    status: index === 104 ? 'cancelled' : 'joined'
  }));
  cloud.database.mockReturnValue(
    createFakeDb({
      activities: [
        {
          _id: 'activity_1',
          organizerOpenId: 'openid_owner'
        }
      ],
      activity_teams: [
        {
          _id: 'team_1',
          activityId: 'activity_1',
          teamName: 'Team 1',
          joinedCount: 104,
          maxMembers: 120
        }
      ],
      registrations
    })
  );

  const result = await getActivityStats.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' }
  );

  expect(result).toMatchObject({
    activityId: 'activity_1',
    totalJoined: 104,
    totalCancelled: 1
  });
});
