const cancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

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
