const removeRegistration = require('../../cloudfunctions/removeRegistration/index');

function createDb({ activity, actorUser, registration, team }) {
  const updates = {
    activity: jest.fn().mockResolvedValue({}),
    registration: jest.fn().mockResolvedValue({}),
    team: jest.fn().mockResolvedValue({})
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
