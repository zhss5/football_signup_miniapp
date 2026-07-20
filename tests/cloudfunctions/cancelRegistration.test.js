const cancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

function createCancellationHarness(options = {}) {
  const updateRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const addLog = jest.fn().mockResolvedValue({});
  const registration = {
    status: 'joined',
    teamId: 'team_white',
    signupName: 'Alex',
    userOpenId: 'openid_player',
    cancelCount: 0,
    ...(options.registration || {})
  };
  const activity = {
    _id: 'activity_1',
    organizerOpenId: 'openid_owner',
    title: 'May 9 training',
    status: 'published',
    signupDeadlineAt: '2026-05-09T19:30:00.000Z',
    startAt: '2026-05-09T20:00:00.000Z',
    joinedCount: 1,
    signupLimitTotal: 12,
    ...(options.activity || {})
  };
  const team = {
    joinedCount: 1,
    ...(options.team || {})
  };
  const transaction = {
    collection: jest.fn(collectionName => ({
      add: addLog,
      doc: jest.fn(() => {
        if (collectionName === 'registrations') {
          return {
            get: jest.fn().mockResolvedValue({ data: registration }),
            update: updateRegistration
          };
        }

        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({ data: activity }),
            update: updateActivity
          };
        }

        if (collectionName === 'activity_teams') {
          return {
            get: jest.fn().mockResolvedValue({ data: team }),
            update: updateTeam
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    }))
  };
  const fakeDb = {
    runTransaction: callback => callback(transaction)
  };

  return {
    fakeDb,
    transaction,
    updateRegistration,
    updateActivity,
    updateTeam,
    addLog
  };
}

function createNotificationDb(seed = {}) {
  const writes = {
    adds: [],
    updates: []
  };
  const data = {
    notification_subscriptions: seed.notificationSubscriptions || {}
  };

  return {
    writes,
    collection(name) {
      return {
        where(query) {
          return {
            async get() {
              return {
                data: Object.values(data[name] || {}).filter(item =>
                  Object.keys(query).every(key => item[key] === query[key])
                )
              };
            }
          };
        },
        doc(id) {
          return {
            async update({ data: updateData }) {
              writes.updates.push({ collection: name, id, data: updateData });
              return {};
            }
          };
        },
        async add({ data: addData }) {
          writes.adds.push({ collection: name, data: addData });
          return { _id: `log_${writes.adds.length}` };
        }
      };
    }
  };
}

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
      add: jest.fn().mockResolvedValue({}),
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

test('cancelRegistration does not notify managers when a regular participant cancels', async () => {
  jest.resetModules();

  const updateRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const fakeDb = {
    runTransaction: callback => callback(transaction)
  };
  const transaction = {
    collection: jest.fn(collectionName => ({
      add: jest.fn().mockResolvedValue({}),
      doc: jest.fn(() => {
        if (collectionName === 'registrations') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'joined',
                teamId: 'team_white',
                signupName: 'Alex',
                cancelCount: 0
              }
            }),
            update: updateRegistration
          };
        }

        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                organizerOpenId: 'openid_owner',
                title: 'May 9 training',
                status: 'published',
                signupDeadlineAt: '2026-05-09T19:30:00.000Z',
                startAt: '2026-05-09T20:00:00.000Z',
                joinedCount: 1,
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
                joinedCount: 1
              }
            }),
            update: updateTeam
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

  const isolatedCancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

  await isolatedCancelRegistration.main(
    { activityId: 'activity_1' },
    {},
    {
      now: '2026-05-09T10:00:00.000Z',
      notifyActivityManagers
    }
  );

  expect(notifyActivityManagers).not.toHaveBeenCalled();

  jest.dontMock('wx-server-sdk');
});

test('cancelRegistration does not notify managers when an admin cancels their own signup', async () => {
  jest.resetModules();

  const updateRegistration = jest.fn().mockResolvedValue({});
  const updateActivity = jest.fn().mockResolvedValue({});
  const updateTeam = jest.fn().mockResolvedValue({});
  const fakeDb = {
    runTransaction: callback => callback(transaction)
  };
  const transaction = {
    collection: jest.fn(collectionName => ({
      add: jest.fn().mockResolvedValue({}),
      doc: jest.fn(() => {
        if (collectionName === 'registrations') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                status: 'joined',
                teamId: 'team_white',
                signupName: 'Admin'
              }
            }),
            update: updateRegistration
          };
        }

        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                organizerOpenId: 'openid_owner',
                status: 'published',
                signupDeadlineAt: '2026-05-09T19:30:00.000Z',
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

        if (collectionName === 'users') {
          return {
            get: jest.fn().mockResolvedValue({
              data: {
                roles: ['admin']
              }
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    }))
  };
  const notifyActivityManagers = jest.fn();

  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_admin' })),
    database: jest.fn(() => fakeDb)
  }));

  const isolatedCancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

  await isolatedCancelRegistration.main(
    { activityId: 'activity_1' },
    {},
    {
      now: '2026-05-09T10:00:00.000Z',
      notifyActivityManagers
    }
  );

  expect(notifyActivityManagers).not.toHaveBeenCalled();

  jest.dontMock('wx-server-sdk');
});

test('cancelRegistration attempts organizer notice inside the default late cancellation window', async () => {
  jest.resetModules();

  const { fakeDb } = createCancellationHarness();
  const notifyActivityOrganizerCancellation = jest.fn().mockResolvedValue({
    recipientOpenId: 'openid_owner',
    status: 'sent'
  });

  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_player' })),
    database: jest.fn(() => fakeDb)
  }));

  const isolatedCancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

  const result = await isolatedCancelRegistration.main(
    { activityId: 'activity_1' },
    {},
    {
      now: '2026-05-09T15:00:00.000Z',
      notifyActivityOrganizerCancellation
    }
  );

  expect(notifyActivityOrganizerCancellation).toHaveBeenCalledWith(
    fakeDb,
    expect.objectContaining({
      activity: expect.objectContaining({
        _id: 'activity_1',
        organizerOpenId: 'openid_owner'
      }),
      actorOpenId: 'openid_player',
      actorName: 'Alex',
      changeType: 'registration_cancelled',
      joinedCountAfter: 0,
      signupLimitTotal: 12,
      stamp: '2026-05-09T15:00:00.000Z'
    }),
    expect.objectContaining({ cloud: expect.any(Object) })
  );
  expect(result).toMatchObject({
    registrationId: 'activity_1_openid_player',
    status: 'cancelled',
    lateCancellationNotice: {
      attempted: true,
      recipientOpenId: 'openid_owner',
      status: 'sent'
    }
  });

  jest.dontMock('wx-server-sdk');
});

test('cancelRegistration skips organizer notice when the late window is disabled', async () => {
  jest.resetModules();

  const { fakeDb } = createCancellationHarness({
    activity: {
      lateCancellationNoticeWindowHours: 0
    }
  });
  const notifyActivityOrganizerCancellation = jest.fn();

  jest.doMock('wx-server-sdk', () => ({
    DYNAMIC_CURRENT_ENV: 'current-env',
    init: jest.fn(),
    getWXContext: jest.fn(() => ({ OPENID: 'openid_player' })),
    database: jest.fn(() => fakeDb)
  }));

  const isolatedCancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

  const result = await isolatedCancelRegistration.main(
    { activityId: 'activity_1' },
    {},
    {
      now: '2026-05-09T15:00:00.000Z',
      notifyActivityOrganizerCancellation
    }
  );

  expect(notifyActivityOrganizerCancellation).not.toHaveBeenCalled();
  expect(result.lateCancellationNotice).toBeUndefined();

  jest.dontMock('wx-server-sdk');
});

test('notifyActivityOrganizerCancellation sends only to the activity creator and writes a cancellation log', async () => {
  const db = createNotificationDb({
    notificationSubscriptions: {
      owner_sub: {
        _id: 'owner_sub',
        activityId: 'activity_1',
        userOpenId: 'openid_owner',
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'accepted'
      },
      admin_sub: {
        _id: 'admin_sub',
        activityId: 'activity_1',
        userOpenId: 'openid_admin',
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'accepted'
      }
    }
  });
  const sendSubscribeMessage = jest.fn().mockResolvedValue({ errCode: 0 });

  const result = await cancelRegistration.notifyActivityOrganizerCancellation(
    db,
    {
      activity: {
        _id: 'activity_1',
        title: 'May 9 training',
        organizerOpenId: 'openid_owner',
        joinedCount: 1,
        signupLimitTotal: 12
      },
      actorOpenId: 'openid_player',
      actorName: 'Alex',
      changeType: 'registration_cancelled',
      joinedCountAfter: 0,
      signupLimitTotal: 12,
      stamp: '2026-05-09T15:00:00.000Z'
    },
    { sendSubscribeMessage }
  );

  expect(result).toMatchObject({
    recipientOpenId: 'openid_owner',
    status: 'sent'
  });
  expect(sendSubscribeMessage).toHaveBeenCalledTimes(1);
  expect(sendSubscribeMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      touser: 'openid_owner',
      templateId: 'tmpl_manager'
    })
  );
  expect(db.writes.adds).toEqual([
    expect.objectContaining({
      collection: 'notification_logs',
      data: expect.objectContaining({
        activityId: 'activity_1',
        actorOpenId: 'openid_player',
        recipientOpenId: 'openid_owner',
        notificationType: 'registration_cancelled',
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'sent'
      })
    })
  ]);
});
