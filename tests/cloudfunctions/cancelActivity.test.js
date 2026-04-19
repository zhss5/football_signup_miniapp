const cancelActivity = require('../../cloudfunctions/cancelActivity/index');

test('cancelActivity marks the activity as cancelled', async () => {
  const result = await cancelActivity.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    {
      runCancelActivity: async () => ({
        activityId: 'activity_1',
        status: 'cancelled'
      })
    }
  );

  expect(result).toMatchObject({
    activityId: 'activity_1',
    status: 'cancelled'
  });
});

test('cancelActivity rejects non-owner requests', async () => {
  await expect(
    cancelActivity.main(
      { activityId: 'activity_1' },
      { OPENID: 'openid_player' },
      {
        runCancelActivity: async () => {
          throw new Error('Only the organizer can cancel this activity');
        }
      }
    )
  ).rejects.toThrow('Only the organizer can cancel this activity');
});
