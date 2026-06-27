const updateActivityReview = require('../../cloudfunctions/updateActivityReview/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
      openid_admin: { _id: 'openid_admin', roles: ['user', 'admin'] },
      openid_regular: { _id: 'openid_regular', roles: ['user'] },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Sunday Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        activitySummary: 'Old summary',
        ...(options.activities || {}).activity_1
      }
    },
    registrations: {
      reg_real: {
        _id: 'reg_real',
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        status: 'joined',
        signupName: 'Alex',
        performanceDescription: 'Old note',
        proxyRegistration: false
      },
      reg_proxy: {
        _id: 'reg_proxy',
        activityId: 'activity_1',
        userOpenId: 'proxy_activity_1_guest',
        status: 'joined',
        signupName: 'Guest',
        performanceDescription: '',
        proxyRegistration: true
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
        async add({ data }) {
          state[name].push({
            _id: `${name}_${state[name].length + 1}`,
            ...data
          });
          return { _id: `${name}_${state[name].length}` };
        }
      };
    }
  };
}

test('organizer can update activity summary and writes an audit log', async () => {
  const db = createFakeDb();

  const result = await updateActivityReview.main(
    {
      activityId: 'activity_1',
      activitySummary: 'Strong turnout and balanced teams.'
    },
    { OPENID: 'openid_owner' },
    { db, now: '2026-06-27T10:00:00.000Z' }
  );

  expect(result.activity).toMatchObject({
    activityId: 'activity_1',
    activitySummary: 'Strong turnout and balanced teams.'
  });
  expect(db.state.activities.activity_1).toMatchObject({
    activitySummary: 'Strong turnout and balanced teams.',
    activitySummaryUpdatedAt: '2026-06-27T10:00:00.000Z',
    activitySummaryUpdatedBy: 'openid_owner'
  });
  expect(db.state.activity_logs[0]).toMatchObject({
    activityId: 'activity_1',
    action: 'activity_summary_update',
    operatorOpenId: 'openid_owner',
    before: {
      activitySummary: 'Old summary'
    },
    after: {
      activitySummary: 'Strong turnout and balanced teams.'
    }
  });
});

test('admin can update proxy participant performance description', async () => {
  const db = createFakeDb();

  const result = await updateActivityReview.main(
    {
      activityId: 'activity_1',
      registrationId: 'reg_proxy',
      performanceDescription: 'Tracked back and filled the right side.'
    },
    { OPENID: 'openid_admin' },
    { db, now: '2026-06-27T10:05:00.000Z' }
  );

  expect(result.registration).toMatchObject({
    registrationId: 'reg_proxy',
    performanceDescription: 'Tracked back and filled the right side.'
  });
  expect(db.state.registrations.reg_proxy).toMatchObject({
    performanceDescription: 'Tracked back and filled the right side.',
    performanceDescriptionUpdatedAt: '2026-06-27T10:05:00.000Z',
    performanceDescriptionUpdatedBy: 'openid_admin'
  });
  expect(db.state.activity_logs[0]).toMatchObject({
    activityId: 'activity_1',
    registrationId: 'reg_proxy',
    userOpenId: 'proxy_activity_1_guest',
    action: 'performance_description_update'
  });
});

test('updateActivityReview enforces permissions and field length limits', async () => {
  await expect(
    updateActivityReview.main(
      {
        activityId: 'activity_1',
        activitySummary: 'Not allowed'
      },
      { OPENID: 'openid_regular' },
      { db: createFakeDb() }
    )
  ).rejects.toThrow('Only the organizer or an admin can update activity review fields');

  await expect(
    updateActivityReview.main(
      {
        activityId: 'activity_1',
        activitySummary: 'a'.repeat(2001)
      },
      { OPENID: 'openid_owner' },
      { db: createFakeDb() }
    )
  ).rejects.toThrow('activitySummary cannot exceed 2000 characters');

  await expect(
    updateActivityReview.main(
      {
        activityId: 'activity_1',
        registrationId: 'reg_real',
        performanceDescription: 'a'.repeat(501)
      },
      { OPENID: 'openid_owner' },
      { db: createFakeDb() }
    )
  ).rejects.toThrow('performanceDescription cannot exceed 500 characters');
});
