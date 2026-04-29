const joinActivity = require('../../cloudfunctions/joinActivity/index');

test('joinActivity rejects full team', async () => {
  await expect(
    joinActivity.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Alex',
        phone: '13800000000',
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
        phone: '13800000000',
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
        phone: '13800000000',
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

test('joinActivity requires a phone number for manual signups', async () => {
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
          throw new Error('unexpected join execution');
        }
      }
    )
  ).rejects.toThrow('Phone is required');
});

test('joinActivity uses the document id without writing _id into registration data', async () => {
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
      phone: '13800000000',
      phoneSource: 'wechat',
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      profileSource: 'wechat'
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
      phoneSnapshot: '13800000000',
      phoneSource: 'wechat',
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      profileSource: 'wechat'
    })
  });
  expect(updateUser).toHaveBeenCalledWith({
    data: expect.objectContaining({
      preferredName: 'Alex',
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      phoneNumber: '13800000000',
      phoneSource: 'wechat',
      profileSource: 'wechat',
      lastActiveAt: '2026-04-19T10:00:00.000Z'
    })
  });

  jest.dontMock('wx-server-sdk');
});
