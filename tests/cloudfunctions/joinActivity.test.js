const joinActivity = require('../../cloudfunctions/joinActivity/index');

test('joinActivity rejects full team', async () => {
  await expect(
    joinActivity.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Alex',
        source: 'share'
      },
      { OPENID: 'openid_a' },
      {
        runJoin: async () => {
          throw new Error('Team is full');
        }
      }
    )
  ).rejects.toThrow('Team is full');
});

test('joinActivity rejects duplicate active registration', async () => {
  await expect(
    joinActivity.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Alex',
        source: 'share'
      },
      { OPENID: 'openid_a' },
      {
        runJoin: async () => {
          throw new Error('You already joined this activity');
        }
      }
    )
  ).rejects.toThrow('You already joined this activity');
});

test('joinActivity rejects signups after deadline', async () => {
  await expect(
    joinActivity.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Alex',
        source: 'share'
      },
      { OPENID: 'openid_a' },
      {
        runJoin: async () => {
          throw new Error('Signup is closed');
        }
      }
    )
  ).rejects.toThrow('Signup is closed');
});

test('joinActivity uses the document id and does not write phone data into registration records', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const updateUser = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: jest.fn(collectionName => ({
      doc: jest.fn(documentId => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'published',
                signupDeadlineAt: '2026-04-20T10:00:00.000Z',
                joinedCount: 0,
                signupLimitTotal: 10
              }
            }),
            update: updateActivity
          };
        }

        if (collectionName === 'activity_teams') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                joinedCount: 0,
                maxMembers: 6
              }
            }),
            update: updateTeam
          };
        }

        if (collectionName === 'registrations') {
          expect(documentId).toBe('activity_1_openid_a');
          return {
            get: jest.fn().mockResolvedValue({ data: null }),
            set: setRegistration
          };
        }

        if (collectionName === 'users') {
          expect(documentId).toBe('openid_a');
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                preferredName: '',
                avatarUrl: '',
                roles: ['user'],
                createdAt: '2026-04-01T10:00:00.000Z'
              }
            }),
            update: updateUser
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    }))
  };

  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_a' })),
    database: jest.fn(() => ({
      runTransaction: callback => callback(transaction)
    }))
  }));

  const isolatedJoinActivity = require('../../cloudfunctions/joinActivity/index');

  await isolatedJoinActivity.main(
    {
      activityId: 'activity_1',
      teamId: 'team_white',
      signupName: 'Alex',
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      profileSource: 'wechat',
      preferredPositions: ['前锋', '门将']
    },
    {},
    { now: '2026-04-19T10:00:00.000Z' }
  );

  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.not.objectContaining({
      _id: expect.anything()
    })
  });
  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      profileSource: 'wechat',
      preferredPositions: ['前锋', '门将']
    })
  });
  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      preferredPositions: ['前锋', '门将']
    })
  });
  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.not.objectContaining({
      phoneSnapshot: expect.anything(),
      phoneSource: expect.anything()
    })
  });
  expect(updateUser).toHaveBeenCalledWith({
    data: expect.objectContaining({
      preferredName: 'Alex',
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      profileSource: 'wechat',
      preferredPositions: ['前锋', '门将'],
      lastActiveAt: '2026-04-19T10:00:00.000Z'
    })
  });
  expect(updateUser).toHaveBeenCalledWith({
    data: expect.not.objectContaining({
      phoneNumber: expect.anything(),
      phoneSource: expect.anything()
    })
  });

  jest.dontMock('wx-server-sdk');
});

test('joinActivity rejects more than two preferred positions', async () => {
  await expect(
    joinActivity.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Alex',
        preferredPositions: ['前锋', '中场', '门将']
      },
      { OPENID: 'openid_a' },
      {
        runJoin: async () => ({ status: 'joined' })
      }
    )
  ).rejects.toThrow('At most two preferred positions are allowed');
});

test('joinActivity preserves optional phone fields when a future signup flow provides them', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const updateUser = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: jest.fn(collectionName => ({
      doc: jest.fn(documentId => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'published',
                signupDeadlineAt: '2026-04-20T10:00:00.000Z',
                joinedCount: 0,
                signupLimitTotal: 10
              }
            }),
            update: updateActivity
          };
        }

        if (collectionName === 'activity_teams') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                joinedCount: 0,
                maxMembers: 6
              }
            }),
            update: updateTeam
          };
        }

        if (collectionName === 'registrations') {
          return {
            get: jest.fn().mockResolvedValue({ data: null }),
            set: setRegistration
          };
        }

        if (collectionName === 'users') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                preferredName: '',
                avatarUrl: '',
                roles: ['user'],
                createdAt: '2026-04-01T10:00:00.000Z'
              }
            }),
            update: updateUser
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    }))
  };

  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_a' })),
    database: jest.fn(() => ({
      runTransaction: callback => callback(transaction)
    }))
  }));

  const isolatedJoinActivity = require('../../cloudfunctions/joinActivity/index');

  await isolatedJoinActivity.main(
    {
      activityId: 'activity_1',
      teamId: 'team_white',
      signupName: 'Alex',
      phone: '13800000000',
      phoneSource: 'wechat'
    },
    {},
    { now: '2026-04-19T10:00:00.000Z' }
  );

  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      phoneSnapshot: '13800000000',
      phoneSource: 'wechat'
    })
  });
  expect(updateUser).toHaveBeenCalledWith({
    data: expect.objectContaining({
      phoneNumber: '13800000000',
      phoneSource: 'wechat'
    })
  });

  jest.dontMock('wx-server-sdk');
});
