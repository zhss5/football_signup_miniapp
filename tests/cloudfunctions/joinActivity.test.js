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
