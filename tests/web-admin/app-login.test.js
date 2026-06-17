const { createWebAdminApp } = require('../../web-admin/src/app');

function createElement() {
  return {
    hidden: false,
    innerHTML: '',
    textContent: '',
    value: '',
    addEventListener: jest.fn()
  };
}

function createAppRoot(elements) {
  return {
    querySelector: jest.fn(selector => elements[selector] || null),
    addEventListener: jest.fn()
  };
}

test('web admin starts with a QR login challenge when no session token is stored', async () => {
  const elements = {
    '[data-view="identity"]': createElement(),
    '[data-view="login"]': createElement(),
    '[data-view="forbidden"]': createElement(),
    '[data-view="workspace"]': createElement(),
    '[data-login-status]': createElement(),
    '[data-login-payload]': createElement(),
    '[data-login-qr]': createElement()
  };
  const appRoot = createAppRoot(elements);
  const api = {
    createWebAdminLogin: jest.fn().mockResolvedValue({
      loginId: 'login_1',
      pollToken: 'poll_1',
      qrPayload: 'football-signup-web-admin-login:login_1:confirm_1'
    })
  };

  const app = createWebAdminApp({
    appRoot,
    api,
    autoPoll: false,
    runtimeRoot: {
      QRCode: {
        toCanvas: jest.fn()
      }
    }
  });

  await app.start();

  expect(api.createWebAdminLogin).toHaveBeenCalledWith();
  expect(elements['[data-view="identity"]'].hidden).toBe(true);
  expect(elements['[data-view="login"]'].hidden).toBe(false);
  expect(elements['[data-view="workspace"]'].hidden).toBe(true);
  expect(elements['[data-login-status]'].textContent).toBe(
    '打开小程序，从“我的”页面扫描此二维码。'
  );
  expect(elements['[data-login-payload]'].value).toBe(
    'football-signup-web-admin-login:login_1:confirm_1'
  );
});

test('web admin stores a confirmed QR session and then loads the workspace', async () => {
  const elements = {
    '[data-view="identity"]': createElement(),
    '[data-view="login"]': createElement(),
    '[data-view="forbidden"]': createElement(),
    '[data-view="workspace"]': createElement(),
    '[data-view="users"]': createElement(),
    '[data-view="activities"]': createElement(),
    '[data-current-user]': createElement(),
    '[data-current-view-title]': createElement(),
    '[data-login-status]': createElement(),
    '[data-login-payload]': createElement(),
    '[data-login-qr]': createElement(),
    '[data-activities-table]': createElement(),
    '[data-users-table]': createElement()
  };
  const appRoot = createAppRoot(elements);
  const storage = {
    getItem: jest.fn().mockReturnValue(''),
    setItem: jest.fn()
  };
  const api = {
    createWebAdminLogin: jest.fn().mockResolvedValue({
      loginId: 'login_1',
      pollToken: 'poll_1',
      qrPayload: 'football-signup-web-admin-login:login_1:confirm_1'
    }),
    pollWebAdminLogin: jest.fn().mockResolvedValue({
      status: 'confirmed',
      webAdminSessionToken: 'session_1',
      user: {
        _id: 'openid_admin',
        roles: ['user', 'admin']
      }
    }),
    setWebAdminSessionToken: jest.fn(),
    getCurrentUser: jest.fn().mockResolvedValue({
      _id: 'openid_admin',
      roles: ['user', 'admin']
    }),
    listActivities: jest.fn().mockResolvedValue({
      items: []
    }),
    listUsers: jest.fn().mockResolvedValue({
      items: []
    })
  };

  const app = createWebAdminApp({
    appRoot,
    api,
    autoPoll: false,
    storage
  });

  await app.start();
  await app.pollWebAdminLogin();

  expect(api.pollWebAdminLogin).toHaveBeenCalledWith('login_1', 'poll_1');
  expect(api.setWebAdminSessionToken).toHaveBeenCalledWith('session_1');
  expect(storage.setItem).toHaveBeenCalledWith(
    'football-signup-web-admin-session',
    'session_1'
  );
  expect(api.getCurrentUser).toHaveBeenCalled();
  expect(elements['[data-view="login"]'].hidden).toBe(true);
  expect(elements['[data-view="workspace"]'].hidden).toBe(false);
});
