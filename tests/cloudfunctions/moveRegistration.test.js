const moveRegistration = require('../../cloudfunctions/moveRegistration/index');

function createDb({ activity, actorUser, registration, sourceTeam, targetTeam }) {
  const updates = {
    activity: jest.fn().mockResolvedValue({}),
    registration: jest.fn().mockResolvedValue({}),
    sourceTeam: jest.fn().mockResolvedValue({}),
    targetTeam: jest.fn().mockResolvedValue({})
  };
  const transaction = {
    collection: jest.fn(collectionName => ({
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
          if (documentId === sourceTeam._id) {
            return {
              get: jest.fn().mockResolvedValue({ data: sourceTeam }),
              update: updates.sourceTeam
            };
          }

          if (documentId === targetTeam._id) {
            return {
              get: jest.fn().mockResolvedValue({ data: targetTeam }),
              update: updates.targetTeam
            };
          }
        }

        throw new Error(`Unexpected lookup ${collectionName}/${documentId}`);
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

test('moveRegistration lets an organizer move a joined member to another team', async () => {
  const stamp = '2026-05-01T10:00:00.000Z';
  const { db, updates } = createDb({
    activity: {
      _id: 'activity_1',
      organizerOpenId: 'openid_owner',
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
    sourceTeam: {
      _id: 'team_white',
      activityId: 'activity_1',
      joinedCount: 2,
      maxMembers: 6,
      status: 'active'
    },
    targetTeam: {
      _id: 'team_red',
      activityId: 'activity_1',
      joinedCount: 1,
      maxMembers: 6,
      status: 'active'
    }
  });

  await expect(
    moveRegistration.main(
      {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        targetTeamId: 'team_red'
      },
      { OPENID: 'openid_owner' },
      { db, now: stamp }
    )
  ).resolves.toMatchObject({
    registrationId: 'activity_1_openid_player',
    userOpenId: 'openid_player',
    fromTeamId: 'team_white',
    teamId: 'team_red',
    moved: true
  });

  expect(updates.registration).toHaveBeenCalledWith({
    data: {
      teamId: 'team_red',
      movedByOpenId: 'openid_owner',
      movedAt: stamp,
      updatedAt: stamp
    }
  });
  expect(updates.sourceTeam).toHaveBeenCalledWith({
    data: {
      joinedCount: 1
    }
  });
  expect(updates.targetTeam).toHaveBeenCalledWith({
    data: {
      joinedCount: 2
    }
  });
  expect(updates.activity).toHaveBeenCalledWith({
    data: {
      updatedAt: stamp
    }
  });
});

test('moveRegistration rejects regular users', async () => {
  const { db } = createDb({
    activity: {
      _id: 'activity_1',
      organizerOpenId: 'openid_owner',
      status: 'published'
    },
    actorUser: {
      _id: 'openid_regular',
      roles: ['user']
    },
    registration: {
      _id: 'activity_1_openid_player',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_player',
      status: 'joined'
    },
    sourceTeam: {
      _id: 'team_white',
      activityId: 'activity_1',
      joinedCount: 1,
      maxMembers: 6,
      status: 'active'
    },
    targetTeam: {
      _id: 'team_red',
      activityId: 'activity_1',
      joinedCount: 0,
      maxMembers: 6,
      status: 'active'
    }
  });

  await expect(
    moveRegistration.main(
      {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        targetTeamId: 'team_red'
      },
      { OPENID: 'openid_regular' },
      { db, now: '2026-05-01T10:00:00.000Z' }
    )
  ).rejects.toThrow('Only the organizer or an admin can move registrations');
});

test('moveRegistration rejects full target teams', async () => {
  const { db } = createDb({
    activity: {
      _id: 'activity_1',
      organizerOpenId: 'openid_owner',
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
    sourceTeam: {
      _id: 'team_white',
      activityId: 'activity_1',
      joinedCount: 1,
      maxMembers: 6,
      status: 'active'
    },
    targetTeam: {
      _id: 'team_red',
      activityId: 'activity_1',
      joinedCount: 6,
      maxMembers: 6,
      status: 'active'
    }
  });

  await expect(
    moveRegistration.main(
      {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        targetTeamId: 'team_red'
      },
      { OPENID: 'openid_owner' },
      { db, now: '2026-05-01T10:00:00.000Z' }
    )
  ).rejects.toThrow('Team is full');
});
