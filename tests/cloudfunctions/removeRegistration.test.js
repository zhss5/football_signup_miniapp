const removeRegistration = require('../../cloudfunctions/removeRegistration/index');

function createDb({ activity, actorUser, registration, team }) {
  const updates = {
    activity: jest.fn().mockResolvedValue({}),
    registration: jest.fn().mockResolvedValue({}),
    team: jest.fn().mockResolvedValue({})
  };
  const transaction = {
    collection: jest.fn(collectionName => ({
      add: jest.fn().mockResolvedValue({}),
      doc: jest.fn(documentId => {
        if (collectionName === 'activities') {
          return {
            get: jest.fn().mockResolvedValue({ data: activity }),
            update: updates.activity
          };
        }

        if (collectionName === 'users') {
          return {
            get: jest.fn().mockResolvedValue({ data: actorUser })
          };
        }

        if (collectionName === 'registrations') {
          expect(documentId).toBe(`${activity._id}_${registration.userOpenId}`);
          return {
            get: jest.fn().mockResolvedValue({ data: registration }),
            update: updates.registration
          };
        }

        if (collectionName === 'activity_teams') {
          expect(documentId).toBe(registration.teamId);
          return {
            get: jest.fn().mockResolvedValue({ data: team }),
            update: updates.team
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    }))
  };

  return {
    updates,
    db: {
      runTransaction: callback => callback(transaction)
    }
  };
}

function createBenchPromotionDb() {
  const state = {
    activities: {
      activity_1: {
        _id: 'activity_1',
        organizerOpenId: 'openid_owner',
        joinedCount: 4,
        status: 'published'
      }
    },
    users: {
      openid_owner: {
        _id: 'openid_owner',
        roles: ['organizer']
      }
    },
    registrations: {
      activity_1_proxy_1: {
        _id: 'activity_1_proxy_1',
        activityId: 'activity_1',
        teamId: 'team_white',
        userOpenId: 'proxy_1',
        signupName: 'Guest',
        proxyRegistration: true,
        status: 'joined',
        joinedAt: '2026-05-01T10:00:00.000Z'
      },
      activity_1_openid_early_bench: {
        _id: 'activity_1_openid_early_bench',
        activityId: 'activity_1',
        teamId: 'team_bench',
        userOpenId: 'openid_early_bench',
        status: 'joined',
        joinedAt: '2026-05-01T11:00:00.000Z'
      },
      activity_1_openid_late_bench: {
        _id: 'activity_1_openid_late_bench',
        activityId: 'activity_1',
        teamId: 'team_bench',
        userOpenId: 'openid_late_bench',
        status: 'joined',
        joinedAt: '2026-05-01T12:00:00.000Z'
      }
    },
    teams: {
      team_white: {
        _id: 'team_white',
        activityId: 'activity_1',
        teamType: 'regular',
        status: 'active',
        sort: 0,
        joinedCount: 2,
        maxMembers: 2
      },
      team_bench: {
        _id: 'team_bench',
        activityId: 'activity_1',
        teamType: 'bench',
        status: 'active',
        sort: 1,
        joinedCount: 2,
        maxMembers: 2
      }
    }
  };
  const logs = [];
  const transaction = {
    collection: jest.fn(collectionName => ({
      add: jest.fn(async ({ data }) => {
        logs.push(data);
        return { _id: `activity_log_${logs.length}` };
      }),
      where: jest.fn(query => ({
        get: jest.fn().mockResolvedValue({
          data: Object.values(
            collectionName === 'registrations' ? state.registrations : state.teams
          ).filter(item => Object.keys(query).every(key => item[key] === query[key]))
        })
      })),
      doc: jest.fn(documentId => ({
        get: jest.fn().mockResolvedValue({
          data:
            collectionName === 'activities'
              ? state.activities[documentId]
              : collectionName === 'users'
                ? state.users[documentId]
                : collectionName === 'registrations'
                  ? state.registrations[documentId]
                  : state.teams[documentId]
        }),
        update: jest.fn(async ({ data }) => {
          const records =
            collectionName === 'activities'
              ? state.activities
              : collectionName === 'registrations'
                ? state.registrations
                : state.teams;
          records[documentId] = {
            ...records[documentId],
            ...data
          };
          return {};
        })
      }))
    }))
  };

  return {
    state,
    logs,
    db: {
      runTransaction: callback => callback(transaction)
    }
  };
}

test('removeRegistration lets the organizer soft-remove a joined member and decrement counts', async () => {
  const stamp = '2026-04-29T10:00:00.000Z';
  const { db, updates } = createDb({
    activity: {
      _id: 'activity_1',
      organizerOpenId: 'openid_owner',
      joinedCount: 2,
      status: 'published'
    },
    actorUser: {
      _id: 'openid_owner',
      roles: ['organizer']
    },
    registration: {
      _id: 'activity_1_openid_player',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_player',
      status: 'joined'
    },
    team: {
      _id: 'team_white',
      joinedCount: 2
    }
  });

  await expect(
    removeRegistration.main(
      {
        activityId: 'activity_1',
        userOpenId: 'openid_player'
      },
      { OPENID: 'openid_owner' },
      { db, now: stamp }
    )
  ).resolves.toMatchObject({
    registrationId: 'activity_1_openid_player',
    status: 'cancelled',
    removed: true
  });

  expect(updates.registration).toHaveBeenCalledWith({
    data: {
      status: 'cancelled',
      cancelledAt: stamp,
      removedByOpenId: 'openid_owner',
      removedAt: stamp,
      removedCount: 1,
      updatedAt: stamp
    }
  });
  expect(updates.activity).toHaveBeenCalledWith({
    data: {
      joinedCount: 1,
      updatedAt: stamp
    }
  });
  expect(updates.team).toHaveBeenCalledWith({
    data: {
      joinedCount: 1
    }
  });
});

test('removeRegistration promotes the earliest bench registration after removing a regular proxy', async () => {
  const { db, state, logs } = createBenchPromotionDb();

  const result = await removeRegistration.main(
    {
      activityId: 'activity_1',
      userOpenId: 'proxy_1'
    },
    { OPENID: 'openid_owner' },
    { db, now: '2026-05-09T15:00:00.000Z' }
  );

  expect(state.registrations.activity_1_proxy_1).toMatchObject({
    status: 'cancelled',
    teamId: 'team_white',
    removedCount: 1
  });
  expect(state.registrations.activity_1_openid_early_bench).toMatchObject({
    status: 'joined',
    teamId: 'team_white',
    joinedAt: '2026-05-01T11:00:00.000Z'
  });
  expect(state.registrations.activity_1_openid_late_bench).toMatchObject({
    status: 'joined',
    teamId: 'team_bench'
  });
  expect(state.activities.activity_1.joinedCount).toBe(3);
  expect(state.teams.team_white.joinedCount).toBe(2);
  expect(state.teams.team_bench.joinedCount).toBe(1);
  expect(logs).toEqual([
    expect.objectContaining({
      action: 'registration_removed',
      registrationId: 'activity_1_proxy_1'
    }),
    expect.objectContaining({
      action: 'registration_auto_promoted',
      registrationId: 'activity_1_openid_early_bench',
      operatorOpenId: 'openid_owner',
      targetOpenId: 'openid_early_bench',
      before: {
        status: 'joined',
        teamId: 'team_bench'
      },
      after: {
        status: 'joined',
        teamId: 'team_white',
        cancelledRegistrationId: 'activity_1_proxy_1',
        queueOrder: 1
      }
    })
  ]);
  expect(result).toMatchObject({
    registrationId: 'activity_1_proxy_1',
    status: 'cancelled',
    removed: true,
    promotedRegistrationId: 'activity_1_openid_early_bench',
    promotedTeamId: 'team_white',
    promotedFromTeamId: 'team_bench'
  });
});

test('removeRegistration lets admins remove members from activities they do not own', async () => {
  const { db } = createDb({
    activity: {
      _id: 'activity_1',
      organizerOpenId: 'openid_owner',
      joinedCount: 1,
      status: 'published'
    },
    actorUser: {
      _id: 'openid_admin',
      roles: ['admin']
    },
    registration: {
      _id: 'activity_1_openid_player',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_player',
      status: 'joined'
    },
    team: {
      _id: 'team_white',
      joinedCount: 1
    }
  });

  await expect(
    removeRegistration.main(
      {
        activityId: 'activity_1',
        userOpenId: 'openid_player'
      },
      { OPENID: 'openid_admin' },
      { db, now: '2026-04-29T10:00:00.000Z' }
    )
  ).resolves.toMatchObject({
    registrationId: 'activity_1_openid_player',
    status: 'cancelled'
  });
});

test('removeRegistration rejects users who are not the organizer or an admin', async () => {
  const { db } = createDb({
    activity: {
      _id: 'activity_1',
      organizerOpenId: 'openid_owner',
      joinedCount: 1,
      status: 'published'
    },
    actorUser: {
      _id: 'openid_other',
      roles: ['user']
    },
    registration: {
      _id: 'activity_1_openid_player',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_player',
      status: 'joined'
    },
    team: {
      _id: 'team_white',
      joinedCount: 1
    }
  });

  await expect(
    removeRegistration.main(
      {
        activityId: 'activity_1',
        userOpenId: 'openid_player'
      },
      { OPENID: 'openid_other' },
      { db, now: '2026-04-29T10:00:00.000Z' }
    )
  ).rejects.toThrow('Only the organizer or an admin can remove registrations');
});
