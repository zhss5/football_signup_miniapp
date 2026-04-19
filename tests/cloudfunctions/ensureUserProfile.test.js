const ensureUserProfile = require('../../cloudfunctions/ensureUserProfile/index');

test('ensureUserProfile creates user with openid primary key', async () => {
  const fakeDb = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: null }),
        set: jest.fn().mockResolvedValue({})
      }))
    }))
  };

  const result = await ensureUserProfile.main(
    {},
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  expect(result.user._id).toBe('openid_a');
  expect(result.user.roles).toEqual(['user']);
});
