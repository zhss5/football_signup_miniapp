const updateTeamColor = require('../../cloudfunctions/updateTeamColor/index');

function createFakeDb({ activity, team, user }) {
  const update = jest.fn().mockResolvedValue({});
  return {
    update,
    collection: jest.fn(name => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          data:
            name === 'activities'
              ? activity
              : name === 'activity_teams'
                ? team
                : name === 'users'
                  ? user
                  : null
        }),
        update
      }))
    }))
  };
}

test('updateTeamColor lets the organizer update one active team color', async () => {
  const db = createFakeDb({
    activity: { _id: 'activity_1', organizerOpenId: 'openid_owner', status: 'published' },
    team: { _id: 'team_1', activityId: 'activity_1', status: 'active' },
    user: { roles: ['user'] }
  });

  await expect(
    updateTeamColor.main(
      { activityId: 'activity_1', teamId: 'team_1', colorKey: 'blue' },
      { OPENID: 'openid_owner' },
      { db, now: '2026-05-09T10:00:00.000Z' }
    )
  ).resolves.toEqual({
    activityId: 'activity_1',
    teamId: 'team_1',
    colorKey: 'blue',
    updated: true
  });

  expect(db.update).toHaveBeenCalledWith({
    data: {
      colorKey: 'blue',
      updatedAt: '2026-05-09T10:00:00.000Z'
    }
  });
});

test('updateTeamColor rejects unsupported colors', async () => {
  const db = createFakeDb({
    activity: { _id: 'activity_1', organizerOpenId: 'openid_owner', status: 'published' },
    team: { _id: 'team_1', activityId: 'activity_1', status: 'active' },
    user: { roles: ['user'] }
  });

  await expect(
    updateTeamColor.main(
      { activityId: 'activity_1', teamId: 'team_1', colorKey: 'purple' },
      { OPENID: 'openid_owner' },
      { db }
    )
  ).rejects.toThrow('Unsupported team color');
});

test('updateTeamColor rejects regular non-owner users', async () => {
  const db = createFakeDb({
    activity: { _id: 'activity_1', organizerOpenId: 'openid_owner', status: 'published' },
    team: { _id: 'team_1', activityId: 'activity_1', status: 'active' },
    user: { roles: ['user'] }
  });

  await expect(
    updateTeamColor.main(
      { activityId: 'activity_1', teamId: 'team_1', colorKey: 'blue' },
      { OPENID: 'openid_other' },
      { db }
    )
  ).rejects.toThrow('Only the organizer or an admin can update team colors');
});
