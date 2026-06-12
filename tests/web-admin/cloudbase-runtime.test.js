const {
  createCloudBaseRuntime,
  installCloudBaseRuntime
} = require('../../web-admin/src/cloudbase-runtime');

test('createCloudBaseRuntime initializes CloudBase with test env settings', async () => {
  const init = jest.fn().mockReturnValue({
    callFunction: jest.fn(),
    auth: {
      signInAnonymously: jest.fn().mockResolvedValue({ user: { uid: 'anon_uid' } })
    }
  });
  const root = {
    cloudbase: { init },
    WEB_ADMIN_CONFIG: {
      CLOUD_ENV_ID: 'cloudbase-miniapp-test-dfc753877',
      REGION: 'ap-shanghai',
      AUTH_MODE: 'anonymous'
    }
  };

  const runtime = await createCloudBaseRuntime(root);

  expect(init).toHaveBeenCalledWith({
    env: 'cloudbase-miniapp-test-dfc753877',
    region: 'ap-shanghai'
  });
  expect(runtime.app.auth.signInAnonymously).toHaveBeenCalled();
  expect(runtime.authMode).toBe('anonymous');
});

test('installCloudBaseRuntime exposes cloudbaseApp and startup promise', async () => {
  const app = {
    callFunction: jest.fn().mockResolvedValue({ result: { ok: true } }),
    auth: {
      signInAnonymously: jest.fn().mockResolvedValue({})
    }
  };
  const root = {
    cloudbase: {
      init: jest.fn().mockReturnValue(app)
    },
    WEB_ADMIN_CONFIG: {
      CLOUD_ENV_ID: 'cloudbase-miniapp-test-dfc753877',
      AUTH_MODE: 'anonymous'
    }
  };

  const ready = installCloudBaseRuntime(root);

  expect(root.webAdminRuntimeReady).toBe(ready);
  await expect(ready).resolves.toMatchObject({ app });
  expect(root.cloudbaseApp).toBe(app);
});

test('installCloudBaseRuntime preserves an injected callFunction adapter', async () => {
  const injected = {
    callFunction: jest.fn()
  };
  const root = {
    cloudbaseApp: injected
  };

  const ready = installCloudBaseRuntime(root);

  await expect(ready).resolves.toEqual({
    app: injected,
    config: {},
    authMode: 'injected'
  });
  expect(root.cloudbaseApp).toBe(injected);
});

test('createCloudBaseRuntime fails clearly when SDK or env config is missing', async () => {
  await expect(createCloudBaseRuntime({ WEB_ADMIN_CONFIG: {} }))
    .rejects
    .toThrow('CloudBase Web SDK is not loaded');

  await expect(createCloudBaseRuntime({ cloudbase: { init: jest.fn() } }))
    .rejects
    .toThrow('WEB_ADMIN_CONFIG.CLOUD_ENV_ID is required');
});
