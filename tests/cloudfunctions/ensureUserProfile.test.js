const ensureUserProfile = require('../../cloudfunctions/ensureUserProfile/index');
const { COLLECTIONS } = require('../../cloudfunctions/_shared/collections');

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

test('ensureUserProfile bootstraps CloudBase collections before reading the user', async () => {
  const operations = [];
  const createCollection = jest.fn(async name => {
    operations.push(`create:${name}`);
  });
  const fakeDb = {
    createCollection,
    collection: jest.fn(() => {
      operations.push('collection:users');
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ data: null }),
          set: jest.fn().mockResolvedValue({})
        }))
      };
    })
  };

  await ensureUserProfile.main(
    {},
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  const collectionNames = Object.values(COLLECTIONS);
  expect(createCollection.mock.calls.map(([name]) => name)).toEqual(collectionNames);
  expect(operations.indexOf('create:activity_logs')).toBeLessThan(
    operations.indexOf('collection:users')
  );
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
