describe('app diagnostics', () => {
  let appConfig;

  beforeEach(() => {
    jest.resetModules();
    appConfig = null;
    global.App = jest.fn(config => {
      appConfig = config;
    });
  });

  afterEach(() => {
    delete global.App;
    jest.restoreAllMocks();
  });

  test('logs app-level errors when diagnostics are enabled', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    jest.doMock('../../miniprogram/config/env', () => ({
      ENABLE_CLOUD_DIAGNOSTICS: true
    }));
    jest.doMock('../../miniprogram/services/cloud', () => ({
      initializeCloudRuntime: jest.fn()
    }));
    jest.doMock('../../miniprogram/utils/i18n', () => ({
      initializeLocale: jest.fn(),
      setAppLocale: jest.fn(),
      t: jest.fn()
    }));

    require('../../miniprogram/app');

    appConfig.onError(new Error('timeout'));
    appConfig.onUnhandledRejection({
      reason: new Error('cloud internal timeout')
    });

    expect(info).toHaveBeenCalledWith('[app] onError', {
      errorText: 'timeout'
    });
    expect(info).toHaveBeenCalledWith('[app] onUnhandledRejection', {
      errorText: 'cloud internal timeout'
    });
  });
});
