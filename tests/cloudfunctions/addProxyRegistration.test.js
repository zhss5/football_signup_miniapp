test('addProxyRegistration lets an organizer add a proxy participant', async () => {
  jest.resetModules();

  const setRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  let registrationDocumentId = '';

  const transaction = {
    collection: jest.fn(collectionName => ({
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
      signupName: 'Guest Player'
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

test('addProxyRegistration rejects regular users', async () => {
  jest.resetModules();

  const transaction = {
    collection: jest.fn(collectionName => ({
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
