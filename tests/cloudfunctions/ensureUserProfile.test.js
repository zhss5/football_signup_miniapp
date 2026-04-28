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

test('ensureUserProfile does not bootstrap collections when users collection exists', async () => {
  const createCollection = jest.fn();
  const fakeDb = {
    createCollection,
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          data: {
            _id: 'openid_a',
            roles: ['user'],
            lastActiveAt: '2026-04-19T09:00:00.000Z'
          }
        }),
        update: jest.fn().mockResolvedValue({})
      }))
    }))
  };

  await ensureUserProfile.main(
    {},
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  expect(createCollection).not.toHaveBeenCalled();
});

test('ensureUserProfile bootstraps CloudBase collections only after users collection is missing', async () => {
  const operations = [];
  const ensureCloudCollections = jest.fn(async () => {
    operations.push('bootstrap');
  });
  const get = jest
    .fn()
    .mockRejectedValueOnce({ errMsg: 'database collection not exists' })
    .mockResolvedValueOnce({ data: null });
  const fakeDb = {
    collection: jest.fn(() => {
      operations.push('collection:users');
      return {
        doc: jest.fn(() => ({
          get,
          set: jest.fn().mockResolvedValue({})
        }))
      };
    })
  };

  await ensureUserProfile.main(
    {},
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z', ensureCloudCollections }
  );

  expect(operations[0]).toBe('collection:users');
  expect(operations.indexOf('bootstrap')).toBeGreaterThan(0);
  expect(get).toHaveBeenCalledTimes(2);
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
