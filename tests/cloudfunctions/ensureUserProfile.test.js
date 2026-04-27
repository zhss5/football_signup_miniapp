const ensureUserProfile = require('../../cloudfunctions/ensureUserProfile/index');

test('ensureUserProfile creates user with openid primary key', async () => {
  const set = jest.fn().mockResolvedValue({});
  const fakeDb = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: null }),
        set
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
  expect(set).toHaveBeenCalledWith({
    data: expect.not.objectContaining({
      _id: expect.anything()
    })
  });
});

test('ensureUserProfile falls back to wx cloud context for openid', async () => {
  const doc = jest.fn(() => ({
    get: jest.fn().mockResolvedValue({ data: null }),
    set: jest.fn().mockResolvedValue({})
  }));
  const fakeDb = {
    collection: jest.fn(() => ({
      doc
    }))
  };

  const result = await ensureUserProfile.main(
    {},
    {},
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z',
      getWXContext: () => ({ OPENID: 'openid_from_cloud_context' })
    }
  );

  expect(doc).toHaveBeenCalledWith('openid_from_cloud_context');
  expect(result.user._id).toBe('openid_from_cloud_context');
});
