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

test('joinActivity rejects rejoin after three prior cancellations or removals with a clear repeat signup message', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const updateUser = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: jest.fn(collectionName => ({
      doc: jest.fn(() => {
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
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'cancelled',
                cancelCount: 2,
                removedCount: 1
              }
            }),
            set: setRegistration
          };
        }

        if (collectionName === 'users') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                preferredName: '',
                roles: ['user']
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

  await expect(
    isolatedJoinActivity.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Alex'
      },
      {},
      { now: '2026-04-19T10:00:00.000Z' }
    )
  ).rejects.toThrow('Too many repeat signups. Please contact the organizer');

  expect(setRegistration).not.toHaveBeenCalled();
  expect(updateActivity).not.toHaveBeenCalled();
  expect(updateTeam).not.toHaveBeenCalled();

  jest.dontMock('wx-server-sdk');
});

test('joinActivity lets the activity organizer rejoin without the repeat-exit limit', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const updateUser = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: jest.fn(collectionName => ({
      doc: jest.fn(() => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                organizerOpenId: 'openid_owner',
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
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'cancelled',
                cancelCount: 3,
                removedCount: 2
              }
            }),
            set: setRegistration
          };
        }

        if (collectionName === 'users') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                preferredName: '',
                roles: ['user']
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
    getWXContext: jest.fn(() => ({ OPENID: 'openid_owner' })),
    database: jest.fn(() => ({
      runTransaction: callback => callback(transaction)
    }))
  }));

  const isolatedJoinActivity = require('../../cloudfunctions/joinActivity/index');

  await expect(
    isolatedJoinActivity.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Owner'
      },
      {},
      { now: '2026-04-19T10:00:00.000Z' }
    )
  ).resolves.toMatchObject({
    status: 'joined'
  });
  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      cancelCount: 3,
      removedCount: 2
    })
  });

  jest.dontMock('wx-server-sdk');
});

test('joinActivity lets an admin rejoin without the repeat-exit limit', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const updateUser = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: jest.fn(collectionName => ({
      doc: jest.fn(() => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                organizerOpenId: 'openid_owner',
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
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'cancelled',
                cancelCount: 3,
                removedCount: 2
              }
            }),
            set: setRegistration
          };
        }

        if (collectionName === 'users') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                preferredName: '',
                roles: ['admin']
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
    getWXContext: jest.fn(() => ({ OPENID: 'openid_admin' })),
    database: jest.fn(() => ({
      runTransaction: callback => callback(transaction)
    }))
  }));

  const isolatedJoinActivity = require('../../cloudfunctions/joinActivity/index');

  await expect(
    isolatedJoinActivity.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Admin'
      },
      {},
      { now: '2026-04-19T10:00:00.000Z' }
    )
  ).resolves.toMatchObject({
    status: 'joined'
  });
  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      cancelCount: 3,
      removedCount: 2
    })
  });

  jest.dontMock('wx-server-sdk');
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

test('joinActivity notifies managers when a regular participant joins', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const updateUser = jest.fn().mockResolvedValue({});
  const fakeDb = {
    runTransaction: callback => callback(transaction)
  };
  const transaction = {
    collection: jest.fn(collectionName => ({
      doc: jest.fn(() => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                organizerOpenId: 'openid_owner',
                title: 'May 9 training',
                status: 'published',
                signupDeadlineAt: '2026-05-09T19:30:00.000Z',
                startAt: '2026-05-09T20:00:00.000Z',
                joinedCount: 0,
                signupLimitTotal: 12
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
                roles: ['user']
              }
            }),
            update: updateUser
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    }))
  };
  const notifyActivityManagers = jest.fn().mockResolvedValue({ sent: 1 });

  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_player' })),
    database: jest.fn(() => fakeDb)
  }));

  const isolatedJoinActivity = require('../../cloudfunctions/joinActivity/index');

  await isolatedJoinActivity.main(
    {
      activityId: 'activity_1',
      teamId: 'team_white',
      signupName: 'Alex'
    },
    {},
    {
      now: '2026-05-09T10:00:00.000Z',
      notifyActivityManagers
    }
  );

  expect(notifyActivityManagers).toHaveBeenCalledWith(
    fakeDb,
    expect.objectContaining({
      activity: expect.objectContaining({
        _id: 'activity_1',
        organizerOpenId: 'openid_owner'
      }),
      actorOpenId: 'openid_player',
      actorName: 'Alex',
      changeType: 'registration_joined',
      joinedCountAfter: 1,
      signupLimitTotal: 12,
      stamp: '2026-05-09T10:00:00.000Z'
    }),
    expect.any(Object)
  );

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

test('joinActivity normalizes signup names with line breaks and length limits', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const updateUser = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: jest.fn(collectionName => ({
      doc: jest.fn(() => {
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
      signupName: '  Alex\nBen😀12345678901234567890  '
    },
    {},
    { now: '2026-04-19T10:00:00.000Z' }
  );

  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      signupName: 'Alex Ben😀1234567'
    })
  });
  expect(updateUser).toHaveBeenCalledWith({
    data: expect.objectContaining({
      preferredName: 'Alex Ben😀1234567'
    })
  });

  jest.dontMock('wx-server-sdk');
});
