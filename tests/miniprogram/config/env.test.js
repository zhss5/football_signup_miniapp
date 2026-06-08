describe('env config', () => {
  beforeEach(() => {
    jest.resetModules();
    delete global.wx;
    jest.doMock('../../../miniprogram/config/env.cloudbase', () => ({}), {
      virtual: true
    });
  });

  afterEach(() => {
    delete global.wx;
  });

  test('defaults to local mock when no private CloudBase config exists', () => {
    jest.doMock('../../../miniprogram/config/env.local', () => ({}));

    const env = require('../../../miniprogram/config/env');

    expect(env).toMatchObject({
      USE_LOCAL_MOCK: true,
      RUNTIME_ENV: 'test',
      CLOUD_ENV_IDS: {
        test: '',
        prod: ''
      },
      CLOUD_ENV_ID: '',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1',
      ENABLE_CLOUD_DIAGNOSTICS: false,
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        activityNotice: '',
        managerRegistrationNotice: ''
      }
    });
    expect(env.getRuntimeEnv('develop')).toBe('test');
    expect(env.getRuntimeEnv('trial')).toBe('test');
    expect(env.getRuntimeEnv('release')).toBe('prod');
  });

  test('selects the test CloudBase environment for trial builds', () => {
    jest.doMock('../../../miniprogram/config/env.cloudbase', () => ({
      CLOUD_ENV_IDS: {
        test: 'test-env-id',
        prod: 'prod-env-id'
      }
    }), {
      virtual: true
    });
    global.wx = {
      getAccountInfoSync: jest.fn(() => ({
        miniProgram: {
          envVersion: 'trial'
        }
      }))
    };
    jest.doMock('../../../miniprogram/config/env.local', () => ({}));

    const env = require('../../../miniprogram/config/env');

    expect(env.RUNTIME_ENV).toBe('test');
    expect(env.CLOUD_ENV_ID).toBe('test-env-id');
    expect(env.USE_LOCAL_MOCK).toBe(false);
  });

  test('selects the production CloudBase environment for release builds', () => {
    jest.doMock('../../../miniprogram/config/env.cloudbase', () => ({
      CLOUD_ENV_IDS: {
        test: 'test-env-id',
        prod: 'prod-env-id'
      }
    }), {
      virtual: true
    });
    global.wx = {
      getAccountInfoSync: jest.fn(() => ({
        miniProgram: {
          envVersion: 'release'
        }
      }))
    };
    jest.doMock('../../../miniprogram/config/env.local', () => ({}));

    const env = require('../../../miniprogram/config/env');

    expect(env.RUNTIME_ENV).toBe('prod');
    expect(env.CLOUD_ENV_ID).toBe('prod-env-id');
    expect(env.USE_LOCAL_MOCK).toBe(false);
  });

  test('merges local overrides on top of the runtime repository config', () => {
    jest.doMock('../../../miniprogram/config/env.cloudbase', () => ({
      CLOUD_ENV_IDS: {
        test: 'test-env-id',
        prod: 'prod-env-id'
      }
    }), {
      virtual: true
    });
    jest.doMock('../../../miniprogram/config/env.local', () => ({
      USE_LOCAL_MOCK: true,
      ENABLE_CLOUD_DIAGNOSTICS: true
    }));

    const env = require('../../../miniprogram/config/env');

    expect(env).toMatchObject({
      USE_LOCAL_MOCK: true,
      RUNTIME_ENV: 'test',
      CLOUD_ENV_ID: 'test-env-id',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1',
      ENABLE_CLOUD_DIAGNOSTICS: true,
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        activityNotice: '',
        managerRegistrationNotice: ''
      }
    });
  });
});
