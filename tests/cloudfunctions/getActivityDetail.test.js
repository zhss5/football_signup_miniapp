const getActivityDetail = require('../../cloudfunctions/getActivityDetail/index');

test('getActivityDetail returns teams and my registration', async () => {
  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_b' },
    {
      loadActivityDetail: async () => ({
        activity: { _id: 'activity_1', title: 'Saturday 8-10' },
        teams: [{ _id: 'team_white', teamName: 'White', members: [] }],
        myRegistration: {
          _id: 'activity_1_openid_b',
          teamId: 'team_white',
          status: 'joined'
        }
      })
    }
  );

  expect(result.activity._id).toBe('activity_1');
  expect(result.teams).toHaveLength(1);
  expect(result.myRegistration.teamId).toBe('team_white');
});
