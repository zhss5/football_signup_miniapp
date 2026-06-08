const EMPTY_CLOUD_ENV_IDS = {
  test: '',
  prod: ''
};

function getMiniProgramEnvVersion() {
  if (typeof wx === 'undefined' || !wx || typeof wx.getAccountInfoSync !== 'function') {
    return '';
  }

  try {
    const accountInfo = wx.getAccountInfoSync();
    return String(
      (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion) || ''
    );
  } catch (error) {
    return '';
  }
}

function getRuntimeEnv(envVersion = getMiniProgramEnvVersion()) {
  return envVersion === 'release' ? 'prod' : 'test';
}

function normalizeCloudEnvId(value) {
  const envId = String(value || '').trim();
  return envId.startsWith('your-') ? '' : envId;
}

function normalizeCloudEnvIds(value = {}) {
  return {
    test: normalizeCloudEnvId(value.test),
    prod: normalizeCloudEnvId(value.prod)
  };
}

let cloudbaseConfig = {};

try {
  // Optional sample-compatible config for non-secret local wiring.
  cloudbaseConfig = require('./env.cloudbase');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    throw error;
  }
}

let localOverrides = {};

try {
  // Optional local-only overrides for real CloudBase wiring.
  localOverrides = require('./env.local');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    throw error;
  }
}

const runtimeEnv = getRuntimeEnv();
const CLOUD_ENV_IDS = normalizeCloudEnvIds({
  ...(cloudbaseConfig.CLOUD_ENV_IDS || EMPTY_CLOUD_ENV_IDS),
  ...(localOverrides.CLOUD_ENV_IDS || {})
});
const cloudEnvId = String(localOverrides.CLOUD_ENV_ID || CLOUD_ENV_IDS[runtimeEnv] || '');

const defaults = {
  USE_LOCAL_MOCK: !cloudEnvId,
  RUNTIME_ENV: runtimeEnv,
  CLOUD_ENV_IDS,
  CLOUD_ENV_ID: cloudEnvId,
  LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1',
  ENABLE_CLOUD_DIAGNOSTICS: false,
  SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
    activityNotice: '',
    managerRegistrationNotice: ''
  }
};

module.exports = {
  ...defaults,
  ...localOverrides,
  RUNTIME_ENV: runtimeEnv,
  CLOUD_ENV_IDS,
  CLOUD_ENV_ID: cloudEnvId,
  getMiniProgramEnvVersion,
  getRuntimeEnv
};
