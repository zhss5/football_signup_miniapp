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

test('api client creates and polls web admin login challenges without a session token', async () => {
  const callFunction = jest
    .fn()
    .mockResolvedValueOnce({
      loginId: 'login_1',
      pollToken: 'poll_1',
      qrPayload: 'football-signup-web-admin-login:login_1:confirm_1'
    })
    .mockResolvedValueOnce({
      status: 'pending'
    });
  const api = createApiClient(callFunction);

  await api.createWebAdminLogin();
  await api.pollWebAdminLogin('login_1', 'poll_1');

  expect(callFunction).toHaveBeenCalledWith('createWebAdminLogin', {});
  expect(callFunction).toHaveBeenCalledWith('pollWebAdminLogin', {
    loginId: 'login_1',
    pollToken: 'poll_1'
  });
});

test('api client attaches the web admin session token to protected calls', async () => {
  const callFunction = jest.fn().mockResolvedValue({
    user: {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    }
  });
  const api = createApiClient(callFunction, {
    webAdminSessionToken: 'session_1'
  });

  await api.getCurrentUser();
  await api.listUsers();
  await api.updateUserRoles('openid_player', ['user']);
  await api.confirmActivity('activity_1');
  await api.updateActivityReview('activity_1', {
    activitySummary: 'Summary'
  });

  expect(callFunction).toHaveBeenCalledWith('ensureUserProfile', {
    webAdminSessionToken: 'session_1'
  });
  expect(callFunction).toHaveBeenCalledWith('listUsers', {
    keyword: '',
    role: '',
    limit: 20,
    skip: 0,
    webAdminSessionToken: 'session_1'
  });
  expect(callFunction).toHaveBeenCalledWith('updateUserRoles', {
    targetOpenId: 'openid_player',
    roles: ['user'],
    webAdminSessionToken: 'session_1'
  });
  expect(callFunction).toHaveBeenCalledWith('notifyActivityParticipants', {
    activityId: 'activity_1',
    notificationType: 'proceeding',
    webAdminSessionToken: 'session_1'
  });
  expect(callFunction).toHaveBeenCalledWith('updateActivityReview', {
    activityId: 'activity_1',
    activitySummary: 'Summary',
    webAdminSessionToken: 'session_1'
  });
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

test('api client resolves CloudBase file IDs to temporary URLs', async () => {
  const callFunction = jest.fn();
  const getTempFileURL = jest.fn().mockResolvedValue({
    fileList: [
      {
        fileID: 'cloud://test-env/user-avatars/player.jpg',
        tempFileURL: 'https://tmp.example.com/player.jpg'
      }
    ]
  });
  const api = createApiClient(callFunction, {
    runtimeRoot: {
      cloudbaseApp: {
        getTempFileURL
      }
    }
  });

  await expect(
    api.resolveFileUrls([
      'cloud://test-env/user-avatars/player.jpg',
      'https://example.com/plain.jpg'
    ])
  ).resolves.toEqual({
    'cloud://test-env/user-avatars/player.jpg': 'https://tmp.example.com/player.jpg'
  });
  expect(getTempFileURL).toHaveBeenCalledWith({
    fileList: ['cloud://test-env/user-avatars/player.jpg']
  });
  expect(callFunction).not.toHaveBeenCalled();
});

test('api client does not expose CloudBase file IDs when storage API is unavailable', async () => {
  const api = createApiClient(jest.fn());

  await expect(api.resolveFileUrls(['cloud://test-env/user-avatars/player.jpg']))
    .resolves
    .toEqual({});
});

test('api client delegates activity operations to existing cloud functions', async () => {
  const callFunction = jest.fn().mockResolvedValue({ items: [], rows: [] });
  const api = createApiClient(callFunction);

  await api.listActivities({ scope: 'web-admin', keyword: 'football' });
  await api.getActivityDetail('activity_1');
  await api.confirmActivity('activity_1');
  await api.setRegistrationAttendance('activity_1', 'reg_1', 'absent');
  await api.updateParticipantManagerAlias('activity_1', 'openid_player', 'Zhang San');
  await api.updateUserManagerAlias('openid_player', 'Left foot');
  await api.updateActivityReview('activity_1', {
    registrationId: 'reg_1',
    performanceDescription: 'Pressed high'
  });
  await api.getAttendanceStats({
    startAt: '2026-06-01',
    endAt: '2026-06-30',
    activityType: 'external',
    limit: 20,
    skip: 20
  });
  await api.exportActivityRoster('activity_1');
  await api.listActivityLogs({ activityId: 'activity_1' });
  await api.listNotificationLogs({ activityId: 'activity_1' });

  expect(callFunction).toHaveBeenCalledWith('listActivities', {
    scope: 'web-admin',
    keyword: 'football'
  });
  expect(callFunction).toHaveBeenCalledWith('getActivityDetail', {
    activityId: 'activity_1'
  });
  expect(callFunction).toHaveBeenCalledWith('notifyActivityParticipants', {
    activityId: 'activity_1',
    notificationType: 'proceeding'
  });
  expect(callFunction).toHaveBeenCalledWith('setRegistrationAttendance', {
    activityId: 'activity_1',
    registrationId: 'reg_1',
    attendanceStatus: 'absent'
  });
  expect(callFunction).toHaveBeenCalledWith('updateParticipantManagerAlias', {
    activityId: 'activity_1',
    targetOpenId: 'openid_player',
    managerAlias: 'Zhang San'
  });
  expect(callFunction).toHaveBeenCalledWith('updateUserManagerAlias', {
    targetOpenId: 'openid_player',
    managerAlias: 'Left foot'
  });
  expect(callFunction).toHaveBeenCalledWith('updateActivityReview', {
    activityId: 'activity_1',
    registrationId: 'reg_1',
    performanceDescription: 'Pressed high'
  });
  expect(callFunction).toHaveBeenCalledWith('getAttendanceStats', {
    startAt: '2026-06-01',
    endAt: '2026-06-30',
    activityType: 'external',
    limit: 20,
    skip: 20
  });
  expect(callFunction).toHaveBeenCalledWith('exportActivityRoster', {
    activityId: 'activity_1'
  });
  expect(callFunction).toHaveBeenCalledWith('listActivityLogs', {
    activityId: 'activity_1'
  });
  expect(callFunction).toHaveBeenCalledWith('listNotificationLogs', {
    activityId: 'activity_1'
  });
});
