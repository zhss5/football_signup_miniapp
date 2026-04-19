const deleteActivity = require('../../cloudfunctions/deleteActivity/index');

test('deleteActivity soft deletes an empty activity', async () => {
  const result = await deleteActivity.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    {
      runDeleteActivity: async () => ({
        activityId: 'activity_1',
        status: 'deleted'
      })
    }
  );

  expect(result).toMatchObject({
    activityId: 'activity_1',
    status: 'deleted'
  });
});

test('deleteActivity rejects deletion when joined players still exist', async () => {
  await expect(
    deleteActivity.main(
      { activityId: 'activity_1' },
      { OPENID: 'openid_owner' },
      {
        runDeleteActivity: async () => {
          throw new Error('Only activities without joined players can be deleted');
        }
      }
    )
  ).rejects.toThrow('Only activities without joined players can be deleted');
});
