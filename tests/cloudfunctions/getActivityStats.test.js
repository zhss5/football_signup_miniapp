const getActivityStats = require('../../cloudfunctions/getActivityStats/index');

test('getActivityStats rejects non-organizer', async () => {
  await expect(
    getActivityStats.main(
      { activityId: 'activity_1' },
      { OPENID: 'openid_user' },
      {
        loadActivity: async () => ({ organizerOpenId: 'openid_owner' })
      }
    )
  ).rejects.toThrow('Not allowed to view activity stats');
});
