function mockCloudTransaction(openid, transaction, fakeDb = {}) {
  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: openid })),
    database: jest.fn(() => ({
      ...fakeDb,
      runTransaction: callback => callback(transaction)
    }))
  }));
}

function createDocCollectionHandler(handlers) {
  return jest.fn(collectionName => {
    const handler = handlers[collectionName];
    if (!handler) {
      throw new Error(`Unexpected collection ${collectionName}`);
    }

    return handler;
  });
}

function createDocHandler(collectionName, byDocumentId) {
  return {
    doc: jest.fn(documentId => {
      const handler = byDocumentId[documentId] || byDocumentId.default;
      if (!handler) {
        throw new Error(`Unexpected document ${collectionName}/${documentId}`);
      }

      return handler;
    })
  };
}

afterEach(() => {
  jest.dontMock('wx-server-sdk');
});

test('joinActivity writes signup_joined activity log for a first signup', async () => {
  jest.resetModules();

  const addActivityLog = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: createDocCollectionHandler({
      activities: createDocHandler('activities', {
        activity_1: {
          get: jest.fn().mockResolvedValue({
            data: {
              organizerOpenId: 'openid_owner',
              status: 'published',
              signupDeadlineAt: '2026-06-10T20:00:00.000Z',
              joinedCount: 0,
              signupLimitTotal: 10
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_teams: createDocHandler('activity_teams', {
        team_green: {
          get: jest.fn().mockResolvedValue({
            data: {
              joinedCount: 0,
              maxMembers: 10
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      registrations: createDocHandler('registrations', {
        activity_1_openid_player: {
          get: jest.fn().mockResolvedValue({ data: null }),
          set: jest.fn().mockResolvedValue({})
        }
      }),
      users: createDocHandler('users', {
        openid_player: {
          get: jest.fn().mockResolvedValue({ data: { roles: ['user'] } }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_logs: {
        add: addActivityLog
      }
    })
  };
  mockCloudTransaction('openid_player', transaction);
  const joinActivity = require('../../cloudfunctions/joinActivity/index');

  await joinActivity.main(
    {
      activityId: 'activity_1',
      teamId: 'team_green',
      signupName: 'Player',
      preferredPositions: ['\u524d\u950b']
    },
    {},
    { now: '2026-06-10T10:00:00.000Z' }
  );

  expect(addActivityLog).toHaveBeenCalledWith({
    data: expect.objectContaining({
      activityId: 'activity_1',
      action: 'signup_joined',
      operatorOpenId: 'openid_player',
      targetOpenId: 'openid_player',
      registrationId: 'activity_1_openid_player',
      teamId: 'team_green',
      createdAt: '2026-06-10T10:00:00.000Z'
    })
  });
});

test('joinActivity writes signup_rejoined activity log when a cancelled user signs up again', async () => {
  jest.resetModules();

  const addActivityLog = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: createDocCollectionHandler({
      activities: createDocHandler('activities', {
        activity_1: {
          get: jest.fn().mockResolvedValue({
            data: {
              organizerOpenId: 'openid_owner',
              status: 'published',
              signupDeadlineAt: '2026-06-10T20:00:00.000Z',
              joinedCount: 1,
              signupLimitTotal: 10
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_teams: createDocHandler('activity_teams', {
        team_green: {
          get: jest.fn().mockResolvedValue({
            data: {
              joinedCount: 1,
              maxMembers: 10
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      registrations: createDocHandler('registrations', {
        activity_1_openid_player: {
          get: jest.fn().mockResolvedValue({
            data: {
              status: 'cancelled',
              teamId: 'team_red',
              cancelCount: 1,
              removedCount: 0
            }
          }),
          set: jest.fn().mockResolvedValue({})
        }
      }),
      users: createDocHandler('users', {
        openid_player: {
          get: jest.fn().mockResolvedValue({ data: { roles: ['user'] } }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_logs: {
        add: addActivityLog
      }
    })
  };
  mockCloudTransaction('openid_player', transaction);
  const joinActivity = require('../../cloudfunctions/joinActivity/index');

  await joinActivity.main(
    {
      activityId: 'activity_1',
      teamId: 'team_green',
      signupName: 'Player'
    },
    {},
    { now: '2026-06-10T10:00:00.000Z' }
  );

  expect(addActivityLog).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'signup_rejoined',
      registrationId: 'activity_1_openid_player',
      targetOpenId: 'openid_player',
      teamId: 'team_green',
      before: expect.objectContaining({
        status: 'cancelled',
        teamId: 'team_red'
      }),
      after: expect.objectContaining({
        status: 'joined',
        teamId: 'team_green'
      })
    })
  });
});

test('cancelRegistration writes signup_cancelled activity log', async () => {
  jest.resetModules();

  const addActivityLog = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: createDocCollectionHandler({
      registrations: createDocHandler('registrations', {
        activity_1_openid_player: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'activity_1_openid_player',
              status: 'joined',
              teamId: 'team_green',
              signupName: 'Player',
              cancelCount: 0
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activities: createDocHandler('activities', {
        activity_1: {
          get: jest.fn().mockResolvedValue({
            data: {
              status: 'published',
              signupDeadlineAt: '2026-06-10T20:00:00.000Z',
              joinedCount: 1
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_teams: createDocHandler('activity_teams', {
        team_green: {
          get: jest.fn().mockResolvedValue({ data: { joinedCount: 1 } }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_logs: {
        add: addActivityLog
      }
    })
  };
  mockCloudTransaction('openid_player', transaction);
  const cancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

  await cancelRegistration.main(
    { activityId: 'activity_1' },
    {},
    { now: '2026-06-10T10:00:00.000Z' }
  );

  expect(addActivityLog).toHaveBeenCalledWith({
    data: expect.objectContaining({
      activityId: 'activity_1',
      action: 'signup_cancelled',
      operatorOpenId: 'openid_player',
      targetOpenId: 'openid_player',
      registrationId: 'activity_1_openid_player',
      teamId: 'team_green',
      createdAt: '2026-06-10T10:00:00.000Z'
    })
  });
});

test('addProxyRegistration writes proxy_signup_created activity log', async () => {
  jest.resetModules();

  const addActivityLog = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: createDocCollectionHandler({
      activities: createDocHandler('activities', {
        activity_1: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'activity_1',
              organizerOpenId: 'openid_owner',
              status: 'published',
              signupDeadlineAt: '2026-06-10T20:00:00.000Z',
              joinedCount: 1,
              signupLimitTotal: 10
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_teams: createDocHandler('activity_teams', {
        team_green: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'team_green',
              activityId: 'activity_1',
              joinedCount: 1,
              maxMembers: 10,
              status: 'active'
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      users: createDocHandler('users', {
        openid_owner: {
          get: jest.fn().mockResolvedValue({ data: { roles: ['user', 'organizer'] } })
        }
      }),
      registrations: createDocHandler('registrations', {
        default: {
          set: jest.fn().mockResolvedValue({})
        }
      }),
      activity_logs: {
        add: addActivityLog
      }
    })
  };
  mockCloudTransaction('openid_owner', transaction);
  const addProxyRegistration = require('../../cloudfunctions/addProxyRegistration/index');

  const result = await addProxyRegistration.main(
    {
      activityId: 'activity_1',
      teamId: 'team_green',
      signupName: 'Guest'
    },
    {},
    {
      now: '2026-06-10T10:00:00.000Z',
      idSuffix: 'abc123'
    }
  );

  expect(addActivityLog).toHaveBeenCalledWith({
    data: expect.objectContaining({
      activityId: 'activity_1',
      action: 'proxy_signup_created',
      operatorOpenId: 'openid_owner',
      targetOpenId: result.userOpenId,
      registrationId: result.registrationId,
      teamId: 'team_green',
      createdAt: '2026-06-10T10:00:00.000Z'
    })
  });
});

test('removeRegistration writes registration_removed activity log', async () => {
  jest.resetModules();

  const addActivityLog = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: createDocCollectionHandler({
      activities: createDocHandler('activities', {
        activity_1: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'activity_1',
              organizerOpenId: 'openid_owner',
              joinedCount: 1,
              status: 'published'
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      users: createDocHandler('users', {
        openid_owner: {
          get: jest.fn().mockResolvedValue({ data: { roles: ['user', 'organizer'] } })
        }
      }),
      registrations: createDocHandler('registrations', {
        activity_1_openid_player: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'activity_1_openid_player',
              activityId: 'activity_1',
              teamId: 'team_green',
              userOpenId: 'openid_player',
              status: 'joined',
              removedCount: 0
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_teams: createDocHandler('activity_teams', {
        team_green: {
          get: jest.fn().mockResolvedValue({ data: { joinedCount: 1 } }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_logs: {
        add: addActivityLog
      }
    })
  };
  mockCloudTransaction('openid_owner', transaction);
  const removeRegistration = require('../../cloudfunctions/removeRegistration/index');

  await removeRegistration.main(
    {
      activityId: 'activity_1',
      userOpenId: 'openid_player'
    },
    {},
    { now: '2026-06-10T10:00:00.000Z' }
  );

  expect(addActivityLog).toHaveBeenCalledWith({
    data: expect.objectContaining({
      activityId: 'activity_1',
      action: 'registration_removed',
      operatorOpenId: 'openid_owner',
      targetOpenId: 'openid_player',
      registrationId: 'activity_1_openid_player',
      teamId: 'team_green',
      createdAt: '2026-06-10T10:00:00.000Z'
    })
  });
});

test('moveRegistration writes registration_moved activity log', async () => {
  jest.resetModules();

  const addActivityLog = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: createDocCollectionHandler({
      activities: createDocHandler('activities', {
        activity_1: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'activity_1',
              organizerOpenId: 'openid_owner',
              status: 'published'
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      users: createDocHandler('users', {
        openid_owner: {
          get: jest.fn().mockResolvedValue({ data: { roles: ['user', 'organizer'] } })
        }
      }),
      registrations: createDocHandler('registrations', {
        activity_1_openid_player: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'activity_1_openid_player',
              activityId: 'activity_1',
              teamId: 'team_green',
              userOpenId: 'openid_player',
              status: 'joined'
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_teams: createDocHandler('activity_teams', {
        team_green: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'team_green',
              activityId: 'activity_1',
              joinedCount: 1,
              maxMembers: 10,
              status: 'active'
            }
          }),
          update: jest.fn().mockResolvedValue({})
        },
        team_red: {
          get: jest.fn().mockResolvedValue({
            data: {
              _id: 'team_red',
              activityId: 'activity_1',
              joinedCount: 0,
              maxMembers: 10,
              status: 'active'
            }
          }),
          update: jest.fn().mockResolvedValue({})
        }
      }),
      activity_logs: {
        add: addActivityLog
      }
    })
  };
  mockCloudTransaction('openid_owner', transaction);
  const moveRegistration = require('../../cloudfunctions/moveRegistration/index');

  await moveRegistration.main(
    {
      activityId: 'activity_1',
      userOpenId: 'openid_player',
      targetTeamId: 'team_red'
    },
    {},
    { now: '2026-06-10T10:00:00.000Z' }
  );

  expect(addActivityLog).toHaveBeenCalledWith({
    data: expect.objectContaining({
      activityId: 'activity_1',
      action: 'registration_moved',
      operatorOpenId: 'openid_owner',
      targetOpenId: 'openid_player',
      registrationId: 'activity_1_openid_player',
      fromTeamId: 'team_green',
      toTeamId: 'team_red',
      createdAt: '2026-06-10T10:00:00.000Z'
    })
  });
});
