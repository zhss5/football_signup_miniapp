const bootstrapV2Collections = require('../../cloudfunctions/bootstrapV2Collections/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_root: {
        _id: 'openid_root',
        roles: ['user', 'super_admin']
      },
      openid_user: {
        _id: 'openid_user',
        roles: ['user']
      },
      ...(options.users || {})
    }
  };

  const createCollection = jest.fn(async name => {
    if ((options.existingCollections || []).includes(name)) {
      throw new Error('collection already exists');
    }
  });

  return {
    state,
    createCollection,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              return { data: state[name] ? state[name][id] || null : null };
            }
          };
        }
      };
    }
  };
}

test('bootstrapV2Collections requires explicit confirmation', async () => {
  const db = createFakeDb();

  await expect(
    bootstrapV2Collections.main({}, {}, { db })
  ).rejects.toThrow('confirm must be bootstrap-v2-collections');

  expect(db.createCollection).not.toHaveBeenCalled();
});

test('bootstrapV2Collections rejects regular mini-program callers', async () => {
  const db = createFakeDb();

  await expect(
    bootstrapV2Collections.main(
      { confirm: 'bootstrap-v2-collections' },
      { OPENID: 'openid_user' },
      { db }
    )
  ).rejects.toThrow('Only super admins can bootstrap V2 collections');

  expect(db.createCollection).not.toHaveBeenCalled();
});

test('bootstrapV2Collections lets super admins create only V2 readiness collections', async () => {
  const db = createFakeDb({
    existingCollections: ['user_role_logs']
  });

  const result = await bootstrapV2Collections.main(
    { confirm: 'bootstrap-v2-collections' },
    { OPENID: 'openid_root' },
    { db }
  );

  expect(db.createCollection).toHaveBeenCalledTimes(4);
  expect(db.createCollection).toHaveBeenNthCalledWith(1, 'activity_logs');
  expect(db.createCollection).toHaveBeenNthCalledWith(2, 'user_role_logs');
  expect(db.createCollection).toHaveBeenNthCalledWith(3, 'notification_logs');
  expect(db.createCollection).toHaveBeenNthCalledWith(4, 'notification_subscriptions');
  expect(result).toEqual({
    ok: true,
    collections: {
      created: ['activity_logs', 'notification_logs', 'notification_subscriptions'],
      existing: ['user_role_logs'],
      skipped: []
    }
  });
});

test('bootstrapV2Collections allows maintenance invocation without OPENID', async () => {
  const db = createFakeDb();

  const result = await bootstrapV2Collections.main(
    { confirm: 'bootstrap-v2-collections' },
    {},
    { db }
  );

  expect(result.collections.created).toEqual([
    'activity_logs',
    'user_role_logs',
    'notification_logs',
    'notification_subscriptions'
  ]);
});
