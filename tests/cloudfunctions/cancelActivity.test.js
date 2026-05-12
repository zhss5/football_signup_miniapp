const cancelActivity = require('../../cloudfunctions/cancelActivity/index');

test('cancelActivity marks the activity as cancelled', async () => {
  const result = await cancelActivity.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    {
      runCancelActivity: async () => ({
        activityId: 'activity_1',
        status: 'cancelled'
      })
    }
  );

  expect(result).toMatchObject({
    activityId: 'activity_1',
    status: 'cancelled'
  });
});

function createFakeDb({ activity, users } = {}) {
  const state = {
    activity: {
      _id: 'activity_1',
      organizerOpenId: 'openid_owner',
      status: 'published',
      ...(activity || {})
    },
    users: {
      openid_admin: { _id: 'openid_admin', roles: ['admin'] },
      openid_player: { _id: 'openid_player', roles: ['user'] },
      ...(users || {})
    }
  };

  return {
    state,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'users') {
                return { data: state.users[id] || null };
              }

              throw new Error(`Unsupported doc lookup: ${name}`);
            }
          };
        }
      };
    },
    async runTransaction(callback) {
      return callback({
        collection(name) {
          return {
            doc(id) {
              return {
                async get() {
                  if (name === 'activities' && id === state.activity._id) {
                    return { data: state.activity };
                  }

                  return { data: null };
                },
                async update({ data }) {
                  if (name === 'activities' && id === state.activity._id) {
                    state.activity = {
                      ...state.activity,
                      ...data
                    };
                    return { updated: 1 };
                  }

                  throw new Error(`Unsupported update: ${name}`);
                }
              };
            }
          };
        }
      });
    }
  };
}

test('cancelActivity lets admins cancel another organizer activity', async () => {
  const db = createFakeDb();

  const result = await cancelActivity.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_admin' },
    { db, now: '2026-05-12T10:00:00.000Z' }
  );

  expect(result).toEqual({
    activityId: 'activity_1',
    status: 'cancelled'
  });
  expect(db.state.activity).toMatchObject({
    status: 'cancelled',
    updatedAt: '2026-05-12T10:00:00.000Z'
  });
});

test('cancelActivity rejects non-owner requests', async () => {
  await expect(
    cancelActivity.main(
      { activityId: 'activity_1' },
      { OPENID: 'openid_player' },
      {
        runCancelActivity: async () => {
          throw new Error('Only the organizer can cancel this activity');
        }
      }
    )
  ).rejects.toThrow('Only the organizer can cancel this activity');
});

test('cancelActivity rejects regular users', async () => {
  await expect(
    cancelActivity.main(
      { activityId: 'activity_1' },
      { OPENID: 'openid_player' },
      { db: createFakeDb(), now: '2026-05-12T10:00:00.000Z' }
    )
  ).rejects.toThrow('Only the organizer or an admin can cancel this activity');
});
