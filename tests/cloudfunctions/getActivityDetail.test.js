const getActivityDetail = require('../../cloudfunctions/getActivityDetail/index');

test('getActivityDetail returns teams and my registration', async () => {
  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_b' },
    {
      loadActivityDetail: async () => ({
        activity: { _id: 'activity_1', title: 'Saturday 8-10' },
        teams: [{ _id: 'team_white', teamName: 'White', members: [] }],
        myRegistration: {
          _id: 'activity_1_openid_b',
          teamId: 'team_white',
          status: 'joined'
        }
      })
    }
  );

  expect(result.activity._id).toBe('activity_1');
  expect(result.teams).toHaveLength(1);
  expect(result.myRegistration.teamId).toBe('team_white');
});

test('getActivityDetail groups joined members under each team', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    organizerOpenId: 'openid_owner',
    addressText: 'Half Stone'
  };
  const teams = [
    {
      _id: 'team_white',
      activityId: 'activity_1',
      teamName: 'White',
      sort: 0,
      maxMembers: 6,
      joinedCount: 1
    },
    {
      _id: 'team_red',
      activityId: 'activity_1',
      teamName: 'Red',
      sort: 1,
      maxMembers: 6,
      joinedCount: 0
    }
  ];
  const registrations = [
    {
      _id: 'activity_1_openid_a',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_a',
      status: 'joined',
      signupName: 'Alex',
      proxyRegistration: true,
      joinedAt: '2026-04-19T10:00:00.000Z'
    }
  ];
  const users = [
    {
      _id: 'openid_a',
      avatarUrl: 'https://example.com/avatar-a.png'
    }
  ];

  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'registrations') {
                const registration = registrations.find(item => item._id === id);
                if (registration) {
                  return { data: registration };
                }

                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            async get() {
              if (name === 'activity_teams') {
                return { data: teams.filter(item => item.activityId === query.activityId) };
              }

              if (name === 'registrations') {
                return {
                  data: registrations.filter(
                    item => item.activityId === query.activityId && item.status === query.status
                  )
                };
              }

              if (name === 'users') {
                return {
                  data: users.filter(item => query._id.values.includes(item._id))
                };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db: fakeDb }
  );

  expect(result.teams).toHaveLength(2);
  expect(result.teams[0].members[0]).toMatchObject({
    signupName: 'Alex',
    avatarUrl: 'https://example.com/avatar-a.png',
    proxyRegistration: true
  });

  const regularResult = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_viewer' },
    { db: fakeDb }
  );

  expect(regularResult.teams[0].members[0]).not.toHaveProperty('proxyRegistration');
});

test('getActivityDetail uses registration avatar when user profile avatar is unavailable', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    addressText: 'Half Stone'
  };
  const teams = [
    {
      _id: 'team_white',
      activityId: 'activity_1',
      teamName: 'White',
      sort: 0,
      maxMembers: 6,
      joinedCount: 1
    }
  ];
  const registrations = [
    {
      _id: 'activity_1_openid_a',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_a',
      status: 'joined',
      signupName: 'Alex',
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      joinedAt: '2026-04-19T10:00:00.000Z'
    }
  ];

  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'registrations') {
                const registration = registrations.find(item => item._id === id);
                if (registration) {
                  return { data: registration };
                }

                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            async get() {
              if (name === 'activity_teams') {
                return { data: teams.filter(item => item.activityId === query.activityId) };
              }

              if (name === 'registrations') {
                return {
                  data: registrations.filter(
                    item => item.activityId === query.activityId && item.status === query.status
                  )
                };
              }

              if (name === 'users') {
                return { data: [] };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_a' },
    { db: fakeDb }
  );

  expect(result.teams[0].members[0]).toMatchObject({
    signupName: 'Alex',
    avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg'
  });
});

test('getActivityDetail returns viewer permissions for organizer and signup cancellation', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    organizerOpenId: 'openid_owner',
    status: 'published',
    joinedCount: 1,
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone'
  };
  const teams = [
    {
      _id: 'team_white',
      activityId: 'activity_1',
      teamName: 'White',
      sort: 0,
      maxMembers: 6,
      joinedCount: 1
    }
  ];
  const registrations = [
    {
      _id: 'activity_1_openid_player',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_player',
      status: 'joined',
      signupName: 'Alex',
      joinedAt: '2026-04-19T10:00:00.000Z'
    }
  ];

  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'registrations') {
                const registration = registrations.find(item => item._id === id);
                if (registration) {
                  return { data: registration };
                }

                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            async get() {
              if (name === 'activity_teams') {
                return { data: teams.filter(item => item.activityId === query.activityId) };
              }

              if (name === 'registrations') {
                return {
                  data: registrations.filter(
                    item => item.activityId === query.activityId && item.status === query.status
                  )
                };
              }

              if (name === 'users') {
                return { data: [] };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const organizerDetail = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db: fakeDb, now: () => '2026-04-26T18:00:00.000Z' }
  );

  expect(organizerDetail.viewer).toMatchObject({
    isOrganizer: true,
    canCancelActivity: true,
    canDeleteActivity: false
  });

  const playerDetail = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_player' },
    { db: fakeDb, now: () => '2026-04-26T18:00:00.000Z' }
  );

  expect(playerDetail.viewer).toMatchObject({
    isOrganizer: false,
    canCancelSignup: true
  });
});

test('getActivityDetail exposes edit permission for admins', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    organizerOpenId: 'openid_owner',
    status: 'published',
    joinedCount: 0,
    signupDeadlineAt: '2026-04-26T19:30:00.000Z'
  };
  const users = {
    openid_admin: {
      _id: 'openid_admin',
      roles: ['admin']
    }
  };
  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'users') {
                return { data: users[id] || null };
              }

              if (name === 'registrations') {
                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            async get() {
              if (name === 'activity_teams' || name === 'registrations' || name === 'users') {
                return { data: [] };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_admin' },
    { db: fakeDb }
  );

  expect(result.viewer).toMatchObject({
    isOrganizer: false,
    canEditActivity: true,
    canManageRegistrations: true
  });
});
