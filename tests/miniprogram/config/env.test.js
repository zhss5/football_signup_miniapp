describe('env config', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('returns the default repository config when no local override exists', () => {
    jest.doMock('../../../miniprogram/config/env.local', () => ({}));

    const env = require('../../../miniprogram/config/env');

    expect(env).toEqual({
      USE_LOCAL_MOCK: true,
      CLOUD_ENV_ID: '',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1',
      ENABLE_CLOUD_DIAGNOSTICS: false
    });
  });

  test('merges local overrides on top of the default repository config', () => {
    jest.doMock('../../../miniprogram/config/env.local', () => ({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: 'prod-env-123'
    }));

    const env = require('../../../miniprogram/config/env');

    expect(env).toEqual({
      USE_LOCAL_MOCK: false,
      CLOUD_ENV_ID: 'prod-env-123',
      LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1',
      ENABLE_CLOUD_DIAGNOSTICS: false
    });
  });
});
