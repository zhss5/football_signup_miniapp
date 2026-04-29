const updateActivity = require('../../cloudfunctions/updateActivity/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
      openid_other: { _id: 'openid_other', roles: ['user', 'organizer'] },
      openid_admin: { _id: 'openid_admin', roles: ['admin'] },
      openid_player: { _id: 'openid_player', roles: ['user'] },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Original Match',
        organizerOpenId: 'openid_owner',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Old address',
        addressName: 'Old field',
        location: null,
        description: '',
        coverImage: '',
        imageList: [],
        signupLimitTotal: 12,
        joinedCount: 2,
        requirePhone: false,
        inviteCode: '',
        status: 'published',
        createdAt: '2026-04-19T10:00:00.000Z',
        updatedAt: '2026-04-19T10:00:00.000Z',
        ...(options.activity || {})
      }
    },
    teams: {
      team_white: {
        _id: 'team_white',
        activityId: 'activity_1',
        teamName: 'White',
        sort: 0,
        maxMembers: 6,
        joinedCount: 2,
        teamType: 'regular',
        status: 'active'
      },
      team_red: {
        _id: 'team_red',
        activityId: 'activity_1',
        teamName: 'Red',
        sort: 1,
        maxMembers: 6,
        joinedCount: 0,
        teamType: 'regular',
        status: 'active'
      },
      ...(options.teams || {})
    },
    logs: []
  };

  const db = {
    state,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'users') {
                return { data: state.users[id] || null };
              }

              if (name === 'activities') {
                return { data: state.activities[id] || null };
              }

              if (name === 'activity_teams') {
                return { data: state.teams[id] || null };
              }

              throw new Error(`Unsupported doc lookup: ${name}`);
            },
            async update({ data }) {
              if (name === 'activities') {
                state.activities[id] = {
                  ...state.activities[id],
                  ...data
                };
                return { updated: 1 };
              }

              if (name === 'activity_teams') {
                state.teams[id] = {
                  ...state.teams[id],
                  ...data
                };
                return { updated: 1 };
              }

              throw new Error(`Unsupported update: ${name}`);
            }
          };
        },
        where(query) {
          return {
            async get() {
              if (name === 'activity_teams') {
                return {
                  data: Object.values(state.teams).filter(item => item.activityId === query.activityId)
                };
              }

              throw new Error(`Unsupported query: ${name}`);
            }
          };
        },
        async add({ data }) {
          if (name === 'activity_logs') {
            state.logs.push(data);
            return { _id: `log_${state.logs.length}` };
          }

          if (name === 'activity_teams') {
            const id = `team_added_${Object.keys(state.teams).length + 1}`;
            state.teams[id] = {
              _id: id,
              ...data
            };
            return { _id: id };
          }

          throw new Error(`Unsupported add: ${name}`);
        }
      };
    }
  };

  return db;
}

function buildUpdatePayload(overrides = {}) {
  return {
    activityId: 'activity_1',
    title: 'Updated Match',
    startAt: '2026-04-27T20:00:00.000Z',
    endAt: '2026-04-27T22:00:00.000Z',
    signupDeadlineAt: '2026-04-27T19:30:00.000Z',
    addressText: 'New address',
    addressName: 'New field',
    location: {
      latitude: 31.2,
      longitude: 121.4
    },
    description: 'Updated notes',
    coverImage: 'cloud://cover-updated',
    imageList: ['cloud://cover-updated'],
    signupLimitTotal: 16,
    requirePhone: true,
    inviteCode: 'NEW',
    ...overrides
  };
}

test('updateActivity lets the activity organizer update editable fields and writes an audit log', async () => {
  const db = createFakeDb();

  const result = await updateActivity.main(
    buildUpdatePayload(),
    { OPENID: 'openid_owner' },
    { db, now: '2026-04-20T10:00:00.000Z' }
  );

  expect(result).toEqual({
    activityId: 'activity_1',
    updated: true,
    changedFields: expect.arrayContaining(['title', 'addressText', 'signupLimitTotal'])
  });
  expect(db.state.activities.activity_1).toMatchObject({
    title: 'Updated Match',
    addressText: 'New address',
    signupLimitTotal: 16,
    organizerOpenId: 'openid_owner',
    joinedCount: 2,
    createdAt: '2026-04-19T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z'
  });
  expect(db.state.logs[0]).toMatchObject({
    activityId: 'activity_1',
    operatorOpenId: 'openid_owner',
    action: 'update_activity'
  });
});

test('updateActivity lets an admin edit another organizer activity', async () => {
  const db = createFakeDb();

  await updateActivity.main(
    buildUpdatePayload({ title: 'Admin Updated Match' }),
    { OPENID: 'openid_admin' },
    { db, now: '2026-04-20T10:00:00.000Z' }
  );

  expect(db.state.activities.activity_1.title).toBe('Admin Updated Match');
});

test('updateActivity rejects regular users and non-owner organizers', async () => {
  await expect(
    updateActivity.main(
      buildUpdatePayload(),
      { OPENID: 'openid_player' },
      { db: createFakeDb(), now: '2026-04-20T10:00:00.000Z' }
    )
  ).rejects.toThrow('Only the organizer or an admin can edit this activity');

  await expect(
    updateActivity.main(
      buildUpdatePayload(),
      { OPENID: 'openid_other' },
      { db: createFakeDb(), now: '2026-04-20T10:00:00.000Z' }
    )
  ).rejects.toThrow('Only the organizer or an admin can edit this activity');
});

test('updateActivity rejects deleted activities and capacity below existing registrations', async () => {
  await expect(
    updateActivity.main(
      buildUpdatePayload(),
      { OPENID: 'openid_owner' },
      {
        db: createFakeDb({ activity: { status: 'deleted' } }),
        now: '2026-04-20T10:00:00.000Z'
      }
    )
  ).rejects.toThrow('Deleted activities cannot be edited');

  await expect(
    updateActivity.main(
      buildUpdatePayload({ signupLimitTotal: 1 }),
      { OPENID: 'openid_owner' },
      { db: createFakeDb(), now: '2026-04-20T10:00:00.000Z' }
    )
  ).rejects.toThrow('Total signup limit cannot be lower than joined players');
});
