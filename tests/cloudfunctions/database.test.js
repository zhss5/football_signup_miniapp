const {
  ensureCloudCollections,
  isCollectionAlreadyExistsError
} = require('../../cloudfunctions/_shared/database');

test('isCollectionAlreadyExistsError does not swallow missing collection errors', () => {
  expect(
    isCollectionAlreadyExistsError({
      errMsg: 'database collection not exists'
    })
  ).toBe(false);
  expect(
    isCollectionAlreadyExistsError({
      errMsg: 'collection already exists'
    })
  ).toBe(true);
  expect(
    isCollectionAlreadyExistsError({
      errCode: -501001,
      errMsg:
        'createCollection:fail -501001 resource system error. [ResourceUnavailable.ResourceExist] Table exist.'
    })
  ).toBe(true);
  expect(
    isCollectionAlreadyExistsError({
      errMsg: '集合已存在'
    })
  ).toBe(true);
});

test('ensureCloudCollections ignores collections that already exist', async () => {
  const db = {
    createCollection: jest.fn().mockRejectedValue({
      errMsg: 'collection already exists'
    })
  };

  const result = await ensureCloudCollections(db, ['users']);

  expect(result).toEqual({
    created: [],
    existing: ['users'],
    skipped: []
  });
});
