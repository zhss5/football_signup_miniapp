describe('cloud service runtime', () => {
  beforeEach(() => {
    jest.resetModules();
    delete global.wx;
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

  test('initializes CloudBase once and calls cloud functions with the configured env id', async () => {
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
});
