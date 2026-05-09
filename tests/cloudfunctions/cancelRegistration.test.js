const cancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

test('cancelRegistration returns cancelled status', async () => {
  const result = await cancelRegistration.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_a' },
    {
      runCancel: async () => ({
        registrationId: 'activity_1_openid_a',
        status: 'cancelled'
      })
    }
  );

  expect(result.status).toBe('cancelled');
});

test('cancelRegistration keeps historical registration id', async () => {
  const result = await cancelRegistration.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_a' },
    {
      runCancel: async () => ({
        registrationId: 'activity_1_openid_a',
        status: 'cancelled'
      })
    }
  );

  expect(result.registrationId).toBe('activity_1_openid_a');
});

test('cancelRegistration rejects cancellations after signup deadline', async () => {
  await expect(
    cancelRegistration.main(
      { activityId: 'activity_1' },
      { OPENID: 'openid_a' },
      {
        runCancel: async () => {
          throw new Error('Signup can no longer be cancelled');
        }
      }
    )
  ).rejects.toThrow('Signup can no longer be cancelled');
});

test('cancelRegistration increments the participant cancellation count', async () => {
  jest.resetModules();

  const updateRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const transaction = {
    collection: jest.fn(collectionName => ({
      doc: jest.fn(() => {
        if (collectionName === 'registrations') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'joined',
                teamId: 'team_white',
                cancelCount: 2
              }
            }),
            update: updateRegistration
          };
        }

        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'published',
                signupDeadlineAt: '2026-04-20T10:00:00.000Z',
                joinedCount: 1
              }
            }),
            update: updateActivity
          };
        }

        if (collectionName === 'activity_teams') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                joinedCount: 1
              }
            }),
            update: updateTeam
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

  const isolatedCancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

  await isolatedCancelRegistration.main(
    { activityId: 'activity_1' },
    {},
    { now: '2026-04-19T10:00:00.000Z' }
  );

  expect(updateRegistration).toHaveBeenCalledWith({
    data: expect.objectContaining({
      status: 'cancelled',
      cancelCount: 3
    })
  });

  jest.dontMock('wx-server-sdk');
});
