const TEST_TEAM_PAGE_SIZE = 100;

function createTestCommand() {
  return {
    gt: value => ({ __operator: 'gt', value })
  };
}

function createPagedTeamQuery(teams, query) {
  let requestedLimit = TEST_TEAM_PAGE_SIZE;
  const queryApi = {
    orderBy: jest.fn(() => queryApi),
    limit: jest.fn(value => {
      requestedLimit = value;
      return queryApi;
    }),
    get: jest.fn(async () => {
      const afterId = query._id && query._id.__operator === 'gt' ? query._id.value : '';
      const data = Object.values(teams)
        .filter(team => team.activityId === query.activityId)
        .filter(team => !afterId || team._id > afterId)
        .sort((left, right) => left._id.localeCompare(right._id))
        .slice(0, Math.min(requestedLimit, TEST_TEAM_PAGE_SIZE));

      return { data };
    })
  };

  return queryApi;
}

test('addProxyRegistration lets an organizer add a proxy participant', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  let registrationDocumentId = '';

  const transaction = {
    collection: jest.fn(collectionName => ({
      add: jest.fn().mockResolvedValue({}),
      doc: jest.fn(documentId => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                _id: 'activity_1',
                organizerOpenId: 'openid_owner',
                status: 'published',
                signupDeadlineAt: '2026-04-20T10:00:00.000Z',
                joinedCount: 1,
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
                _id: 'team_white',
                activityId: 'activity_1',
                joinedCount: 1,
                maxMembers: 6,
                status: 'active'
              }
            }),
            update: updateTeam
          };
        }

        if (collectionName === 'users') {
          expect(documentId).toBe('openid_owner');
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                roles: ['user', 'organizer']
              }
            })
          };
        }

        if (collectionName === 'registrations') {
          registrationDocumentId = documentId;
          return {
            set: setRegistration
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

  const addProxyRegistration = require('../../cloudfunctions/addProxyRegistration/index');

  const result = await addProxyRegistration.main(
    {
      activityId: 'activity_1',
      teamId: 'team_white',
      signupName: 'Guest Player',
      preferredPositions: ['\u524d\u950b', '\u95e8\u5c06']
    },
    {},
    {
      now: '2026-04-19T10:00:00.000Z',
      idSuffix: 'abc123'
    }
  );

  expect(registrationDocumentId).toMatch(/^activity_1_proxy_activity_1_\d+_abc123$/);
  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      activityId: 'activity_1',
      teamId: 'team_white',
      signupName: 'Guest Player',
      userOpenId: expect.stringMatching(/^proxy_activity_1_\d+_abc123$/),
      status: 'joined',
      source: 'proxy',
      profileSource: 'proxy',
      preferredPositions: ['\u524d\u950b', '\u95e8\u5c06'],
      proxyRegistration: true,
      createdByOpenId: 'openid_owner'
    })
  });
  expect(updateActivity).toHaveBeenCalledWith({
    data: {
      joinedCount: 2,
      updatedAt: '2026-04-19T10:00:00.000Z'
    }
  });
  expect(updateTeam).toHaveBeenCalledWith({
    data: {
      joinedCount: 2
    }
  });
  expect(result).toMatchObject({
    teamId: 'team_white',
    status: 'joined',
    proxyRegistration: true
  });

  jest.dontMock('wx-server-sdk');
});

test('addProxyRegistration rejects more than two preferred positions', async () => {
  jest.resetModules();

  const runAddProxyRegistration = jest.fn();

  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_owner' }))
  }));

  const addProxyRegistration = require('../../cloudfunctions/addProxyRegistration/index');

  await expect(
    addProxyRegistration.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Guest Player',
        preferredPositions: ['\u524d\u950b', '\u4e2d\u573a', '\u95e8\u5c06']
      },
      {},
      {
        runAddProxyRegistration
      }
    )
  ).rejects.toThrow('At most two preferred positions are allowed');

  expect(runAddProxyRegistration).not.toHaveBeenCalled();
  jest.dontMock('wx-server-sdk');
});

test('addProxyRegistration rejects regular users', async () => {
  jest.resetModules();

  const transaction = {
    collection: jest.fn(collectionName => ({
      add: jest.fn().mockResolvedValue({}),
      doc: jest.fn(() => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                _id: 'activity_1',
                organizerOpenId: 'openid_owner',
                status: 'published',
                signupDeadlineAt: '2026-04-20T10:00:00.000Z',
                joinedCount: 0,
                signupLimitTotal: 10
              }
            })
          };
        }

        if (collectionName === 'users') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                roles: ['user']
              }
            })
          };
        }

        return {
          get: jest.fn().mockResolvedValue({ data: null })
        };
      })
    }))
  };

  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_regular' })),
    database: jest.fn(() => ({
      runTransaction: callback => callback(transaction)
    }))
  }));

  const addProxyRegistration = require('../../cloudfunctions/addProxyRegistration/index');

  await expect(
    addProxyRegistration.main(
      {
        activityId: 'activity_1',
        teamId: 'team_white',
        signupName: 'Guest Player'
      },
      {},
      {
        now: '2026-04-19T10:00:00.000Z'
      }
    )
  ).rejects.toThrow('Only the organizer or an admin can add participants');

  jest.dontMock('wx-server-sdk');
});

test('addProxyRegistration normalizes proxy participant names', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: jest.fn(collectionName => ({
      add: jest.fn().mockResolvedValue({}),
      doc: jest.fn(() => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                _id: 'activity_1',
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
                _id: 'team_white',
                activityId: 'activity_1',
                joinedCount: 0,
                maxMembers: 6,
                status: 'active'
              }
            }),
            update: updateTeam
          };
        }

        if (collectionName === 'users') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                roles: ['user', 'organizer']
              }
            })
          };
        }

        if (collectionName === 'registrations') {
          return {
            set: setRegistration
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

  const addProxyRegistration = require('../../cloudfunctions/addProxyRegistration/index');

  await addProxyRegistration.main(
    {
      activityId: 'activity_1',
      teamId: 'team_white',
      signupName: '  Guest\nPlayer😀123456789  '
    },
    {},
    {
      now: '2026-04-19T10:00:00.000Z',
      idSuffix: 'abc123'
    }
  );

  expect(setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      signupName: 'Guest Player😀123'
    })
  });

  jest.dontMock('wx-server-sdk');
});

test('addProxyRegistration finds a regular-team vacancy after the first 100 team documents', async () => {
  jest.resetModules();

  const overflowTeams = {};
  for (let index = 0; index < TEST_TEAM_PAGE_SIZE; index += 1) {
    const id = `aa_team_${String(index).padStart(3, '0')}`;
    overflowTeams[id] = {
      _id: id,
      activityId: 'activity_1',
      teamName: `Full ${index}`,
      teamType: 'regular',
      sort: index + 10,
      joinedCount: 1,
      maxMembers: 1,
      status: 'active'
    };
  }

  const harness = createProxyTransactionHarness({
    teams: {
      ...overflowTeams,
      team_bench: {
        _id: 'team_bench',
        activityId: 'activity_1',
        teamName: 'Bench',
        teamType: 'bench',
        sort: 99,
        joinedCount: 0,
        maxMembers: 2,
        status: 'active'
      },
      team_red: {
        _id: 'team_red',
        activityId: 'activity_1',
        teamName: 'Red',
        teamType: 'regular',
        sort: 2,
        joinedCount: 0,
        maxMembers: 2,
        status: 'active'
      },
      team_white: {
        _id: 'team_white',
        activityId: 'activity_1',
        teamName: 'White',
        teamType: 'regular',
        sort: 1,
        joinedCount: 1,
        maxMembers: 2,
        status: 'active'
      }
    }
  });
  mockCloudDatabase(harness.transaction);

  const addProxyRegistration = require('../../cloudfunctions/addProxyRegistration/index');
  const result = await addProxyRegistration.main(
    {
      activityId: 'activity_1',
      teamId: 'team_bench',
      signupName: 'Guest Player'
    },
    {},
    {
      now: '2026-04-19T10:00:00.000Z',
      idSuffix: 'bench123'
    }
  );

  expect(harness.setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      teamId: 'team_white',
      proxyRegistration: true
    })
  });
  expect(harness.updatedTeamIds).toEqual(['team_white']);
  expect(harness.logAdd).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'proxy_signup_created',
      teamId: 'team_white',
      after: expect.objectContaining({
        teamId: 'team_white',
        requestedTeamId: 'team_bench',
        autoAssigned: true
      })
    })
  });
  expect(result).toMatchObject({
    requestedTeamId: 'team_bench',
    teamId: 'team_white',
    teamName: 'White',
    autoAssigned: true,
    autoAssignedReason: 'regular_slot_available'
  });

  jest.dontMock('wx-server-sdk');
});

test('addProxyRegistration keeps a bench request in bench when regular teams are full', async () => {
  jest.resetModules();

  const harness = createProxyTransactionHarness({
    teams: {
      team_regular: {
        _id: 'team_regular',
        activityId: 'activity_1',
        teamName: 'Regular',
        teamType: 'regular',
        sort: 1,
        joinedCount: 2,
        maxMembers: 2,
        status: 'active'
      },
      team_bench: {
        _id: 'team_bench',
        activityId: 'activity_1',
        teamName: 'Bench',
        teamType: 'bench',
        sort: 99,
        joinedCount: 0,
        maxMembers: 2,
        status: 'active'
      }
    }
  });
  mockCloudDatabase(harness.transaction);

  const addProxyRegistration = require('../../cloudfunctions/addProxyRegistration/index');
  const result = await addProxyRegistration.main(
    {
      activityId: 'activity_1',
      teamId: 'team_bench',
      signupName: 'Bench Guest'
    },
    {},
    {
      now: '2026-04-19T10:00:00.000Z',
      idSuffix: 'bench456'
    }
  );

  expect(harness.setRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      teamId: 'team_bench'
    })
  });
  expect(harness.updatedTeamIds).toEqual(['team_bench']);
  expect(result).toMatchObject({
    requestedTeamId: 'team_bench',
    teamId: 'team_bench',
    teamName: 'Bench',
    autoAssigned: false,
    autoAssignedReason: ''
  });

  jest.dontMock('wx-server-sdk');
});

test('addProxyRegistration keeps explicit regular-team selection when that team is full', async () => {
  jest.resetModules();

  const harness = createProxyTransactionHarness({
    teams: {
      team_requested: {
        _id: 'team_requested',
        activityId: 'activity_1',
        teamName: 'Requested',
        teamType: 'regular',
        sort: 1,
        joinedCount: 2,
        maxMembers: 2,
        status: 'active'
      },
      team_other: {
        _id: 'team_other',
        activityId: 'activity_1',
        teamName: 'Other',
        teamType: 'regular',
        sort: 2,
        joinedCount: 0,
        maxMembers: 2,
        status: 'active'
      }
    }
  });
  mockCloudDatabase(harness.transaction);

  const addProxyRegistration = require('../../cloudfunctions/addProxyRegistration/index');

  await expect(
    addProxyRegistration.main(
      {
        activityId: 'activity_1',
        teamId: 'team_requested',
        signupName: 'Guest Player'
      },
      {},
      {
        now: '2026-04-19T10:00:00.000Z',
        idSuffix: 'regular123'
      }
    )
  ).rejects.toThrow('Team is full');

  expect(harness.setRegistration).not.toHaveBeenCalled();
  expect(harness.updatedTeamIds).toEqual([]);

  jest.dontMock('wx-server-sdk');
});

function mockCloudDatabase(transaction) {
  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_owner' })),
    database: jest.fn(() => ({
      command: createTestCommand(),
      runTransaction: callback => callback(transaction)
    }))
  }));
}

function createProxyTransactionHarness({ teams }) {
  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const logAdd = jest.fn().mockResolvedValue({});
  const updatedTeamIds = [];
  const activity = {
    _id: 'activity_1',
    organizerOpenId: 'openid_owner',
    status: 'published',
    signupDeadlineAt: '2026-04-20T10:00:00.000Z',
    joinedCount: Object.values(teams).reduce((total, team) => total + Number(team.joinedCount || 0), 0),
    signupLimitTotal: Object.values(teams).reduce((total, team) => total + Number(team.maxMembers || 0), 0)
  };

  const transaction = {
    collection: jest.fn(collectionName => {
      if (collectionName === 'activity_teams') {
        return {
          where: jest.fn(query => createPagedTeamQuery(teams, query)),
          doc: jest.fn(documentId => ({
            get: jest.fn().mockResolvedValue({ data: teams[documentId] || null }),
            update: jest.fn().mockImplementation(async ({ data }) => {
              updatedTeamIds.push(documentId);
              Object.assign(teams[documentId], data);
            })
          }))
        };
      }

      if (collectionName === 'activities') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ data: activity }),
            update: updateActivity
          }))
        };
      }

      if (collectionName === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              data: { roles: ['user', 'organizer'] }
            })
          }))
        };
      }

      if (collectionName === 'registrations') {
        return {
          doc: jest.fn(() => ({ set: setRegistration }))
        };
      }

      if (collectionName === 'activity_logs') {
        return { add: logAdd };
      }

      throw new Error(`Unexpected collection ${collectionName}`);
    })
  };

  return {
    transaction,
    setRegistration,
    updateActivity,
    logAdd,
    updatedTeamIds
  };
}
