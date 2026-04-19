const createActivity = require('../../cloudfunctions/createActivity/index');

test('createActivity stores activity and teams', async () => {
  const writes = [];
  const fakeDb = {
    collection: jest.fn(name => ({
      add: jest.fn(async ({ data }) => {
        writes.push({ name, data });
        return { _id: name === 'activities' ? 'activity_1' : `${name}_${writes.length}` };
      })
    }))
  };

  const result = await createActivity.main(
    {
      title: 'Saturday 8-10',
      startAt: '2026-04-26T20:00:00.000Z',
      endAt: '2026-04-26T22:00:00.000Z',
      addressText: 'Half Stone',
      signupLimitTotal: 12,
      requirePhone: false,
      teams: [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ]
    },
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  expect(result.activityId).toBe('activity_1');
  expect(writes.filter(item => item.name === 'activity_teams')).toHaveLength(2);
});
