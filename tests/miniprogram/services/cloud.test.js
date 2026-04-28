describe('cloud service runtime', () => {
  beforeEach(() => {
    jest.resetModules();
    delete globalThis.wx;
    globalThis.global = globalThis;
  });

  afterEach(() => {
    globalThis.global = globalThis;
    jest.restoreAllMocks();
  });

  test('uses the local mock client when local mock mode is enabled', async () => {
    const localCall = jest.fn().mockResolvedValue({ ok: true });

    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: true,
      CLOUD_ENV_ID: '',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
    }));

    jest.doMock('../../../miniprogram/mocks/local-cloud', () => ({
      buildStorageAdapter: jest.fn(() => ({})),
      createLocalCloudClient: jest.fn(() => ({
        call: localCall
      }))
    }));

    const cloud = require('../../../miniprogram/services/cloud');

    await expect(cloud.call('listActivities', { scope: 'home' })).resolves.toEqual({ ok: true });
    expect(localCall).toHaveBeenCalledWith('listActivities', { scope: 'home' });
  });

  test('throws a clear error when CloudBase mode is enabled without a cloud env id', () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: '',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
    }));

    global.wx = {
      cloud: {
        init: jest.fn(),
        callFunction: jest.fn()
      }
    };

    const cloud = require('../../../miniprogram/services/cloud');

    expect(() => cloud.initializeCloudRuntime()).toThrow('CLOUD_ENV_ID is required when USE_LOCAL_MOCK is false');
  });

  test('initializes CloudBase once with user tracing and calls cloud functions with the configured env id', async () => {
    const init = jest.fn();
    const callFunction = jest.fn().mockResolvedValue({
      result: {
        activityId: 'activity_123'
      }
    });

    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: 'prod-env-123',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
    }));

    global.wx = {
      cloud: {
        init,
        callFunction
      }
    };

    const cloud = require('../../../miniprogram/services/cloud');

    expect(cloud.initializeCloudRuntime()).toEqual({
      mode: 'cloudbase',
      envId: 'prod-env-123'
    });

    await expect(cloud.call('createActivity', { title: 'Thursday Match' })).resolves.toEqual({
      activityId: 'activity_123'
    });

    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith({
      env: 'prod-env-123',
      traceUser: true
    });
    expect(callFunction).toHaveBeenCalledWith({
      name: 'createActivity',
      data: {
        title: 'Thursday Match'
      }
    });

    cloud.initializeCloudRuntime();
    expect(init).toHaveBeenCalledTimes(1);
  });

  test('uploads files to CloudBase storage and returns the file id', async () => {
    const init = jest.fn();
    const uploadFile = jest.fn().mockResolvedValue({
      fileID: 'cloud://prod-env-123/activity-covers/cover.jpg'
    });

    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: 'prod-env-123',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
    }));

    global.wx = {
      cloud: {
        init,
        callFunction: jest.fn(),
        uploadFile
      }
    };

    const cloud = require('../../../miniprogram/services/cloud');

    await expect(
      cloud.uploadFile('wxfile://tmp_cover.jpg', 'activity-covers/cover.jpg')
    ).resolves.toBe('cloud://prod-env-123/activity-covers/cover.jpg');

    expect(uploadFile).toHaveBeenCalledWith({
      cloudPath: 'activity-covers/cover.jpg',
      filePath: 'wxfile://tmp_cover.jpg'
    });
  });

  test('keeps local mock file paths unchanged', async () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: true,
      CLOUD_ENV_ID: '',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
    }));

    const cloud = require('../../../miniprogram/services/cloud');

    await expect(cloud.uploadFile('wxfile://tmp_cover.jpg')).resolves.toBe(
      'wxfile://tmp_cover.jpg'
    );
  });

  test('throws a clear error when WeChat cloud capability is unavailable in CloudBase mode', () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: 'prod-env-123',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
    }));

    global.wx = {};

    const cloud = require('../../../miniprogram/services/cloud');

    expect(() => cloud.initializeCloudRuntime()).toThrow('Cloud capability is required');
  });

  test('initializes CloudBase when wx exists even if global.wx is unavailable', () => {
    const init = jest.fn();

    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: 'prod-env-123',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
    }));

    global.wx = {
      cloud: {
        init,
        callFunction: jest.fn()
      }
    };

    global.global = {};

    const cloud = require('../../../miniprogram/services/cloud');

    expect(cloud.initializeCloudRuntime()).toEqual({
      mode: 'cloudbase',
      envId: 'prod-env-123'
    });
    expect(init).toHaveBeenCalledTimes(1);
  });

  test('logs cloud call diagnostics when enabled', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const callFunction = jest.fn().mockResolvedValue({
      result: {
        items: []
      }
    });

    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: 'prod-env-123',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1',
      ENABLE_CLOUD_DIAGNOSTICS: true
    }));

    global.wx = {
      cloud: {
        init: jest.fn(),
        callFunction
      }
    };

    const cloud = require('../../../miniprogram/services/cloud');

    await expect(cloud.call('listActivities', { scope: 'home' })).resolves.toEqual({
      items: []
    });

    expect(info).toHaveBeenCalledWith('[cloud] init:start', { envId: 'prod-env-123' });
    expect(info).toHaveBeenCalledWith('[cloud] init:success', { envId: 'prod-env-123' });
    expect(info).toHaveBeenCalledWith('[cloud] call:start', { name: 'listActivities' });
    expect(info).toHaveBeenCalledWith(
      '[cloud] call:success',
      expect.objectContaining({ name: 'listActivities', elapsedMs: expect.any(Number) })
    );

    info.mockRestore();
  });

  test('logs cloud call failure diagnostics with readable error text', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const callFunction = jest.fn().mockRejectedValue(
      new Error('cloud.callFunction:fail Error: errCode: -501001 resource system error | errMsg: Environment not found')
    );

    jest.doMock('../../../miniprogram/config/env', () => ({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: 'prod-env-123',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1',
      ENABLE_CLOUD_DIAGNOSTICS: true
    }));

    global.wx = {
      cloud: {
        init: jest.fn(),
        callFunction
      }
    };

    const cloud = require('../../../miniprogram/services/cloud');

    await expect(cloud.call('listActivities', { scope: 'home' })).rejects.toThrow(
      'Environment not found'
    );

    expect(info).toHaveBeenCalledWith(
      '[cloud] call:failure',
      expect.objectContaining({
        name: 'listActivities',
        elapsedMs: expect.any(Number),
        errorText:
          'cloud.callFunction:fail Error: errCode: -501001 resource system error | errMsg: Environment not found'
      })
    );

    info.mockRestore();
  });
});
