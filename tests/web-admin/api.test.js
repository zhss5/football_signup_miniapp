const { createApiClient } = require('../../web-admin/src/api');

test('api client loads current identity through ensureUserProfile', async () => {
  const callFunction = jest.fn().mockResolvedValue({
    user: {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    }
  });
  const api = createApiClient(callFunction);

  await expect(api.getCurrentUser()).resolves.toEqual({
    _id: 'openid_admin',
    roles: ['user', 'admin']
  });
  expect(callFunction).toHaveBeenCalledWith('ensureUserProfile', {});
});

test('api client delegates user search to listUsers', async () => {
  const callFunction = jest.fn().mockResolvedValue({
    items: [],
    hasMore: false
  });
  const api = createApiClient(callFunction);

  await api.listUsers({
    keyword: 'zhang',
    role: 'organizer',
    limit: 20,
    skip: 0
  });

  expect(callFunction).toHaveBeenCalledWith('listUsers', {
    keyword: 'zhang',
    role: 'organizer',
    limit: 20,
    skip: 0
  });
});

test('api client delegates role changes to updateUserRoles', async () => {
  const callFunction = jest.fn().mockResolvedValue({
    user: {
      _id: 'openid_player',
      roles: ['user', 'organizer']
    }
  });
  const api = createApiClient(callFunction);

  await api.updateUserRoles('openid_player', ['user', 'organizer']);

  expect(callFunction).toHaveBeenCalledWith('updateUserRoles', {
    targetOpenId: 'openid_player',
    roles: ['user', 'organizer']
  });
});
