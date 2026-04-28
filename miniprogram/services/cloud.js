const {
  USE_LOCAL_MOCK,
  LOCAL_STORAGE_KEY,
  CLOUD_ENV_ID,
  ENABLE_CLOUD_DIAGNOSTICS
} = require('../config/env');
const { buildStorageAdapter, createLocalCloudClient } = require('../mocks/local-cloud');

let localCloudClient = null;
let cloudRuntime = null;

function getWxRuntime() {
  if (typeof wx !== 'undefined' && wx) {
    return wx;
  }

  if (typeof globalThis !== 'undefined' && globalThis.wx) {
    return globalThis.wx;
  }

  return null;
}

function getLocalCloudClient() {
  if (!localCloudClient) {
    localCloudClient = createLocalCloudClient({
      storage: buildStorageAdapter(LOCAL_STORAGE_KEY),
      storageKey: LOCAL_STORAGE_KEY
    });
  }

  return localCloudClient;
}

function getNowMs() {
  if (
    typeof performance !== 'undefined' &&
    performance &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }

  return Date.now();
}

function summarizeError(error) {
  if (!error) {
    return {};
  }

  return {
    message: error.message,
    errMsg: error.errMsg,
    errCode: error.errCode,
    code: error.code
  };
}

function logCloudDiagnostic(event, details) {
  if (!ENABLE_CLOUD_DIAGNOSTICS || typeof console === 'undefined' || !console.info) {
    return;
  }

  console.info(`[cloud] ${event}`, details || {});
}

function initializeCloudRuntime() {
  if (USE_LOCAL_MOCK) {
    return {
      mode: 'local-mock'
    };
  }

  if (!CLOUD_ENV_ID) {
    throw new Error('CLOUD_ENV_ID is required when USE_LOCAL_MOCK is false');
  }

  const wxRuntime = getWxRuntime();

  if (!wxRuntime || !wxRuntime.cloud) {
    throw new Error('Cloud capability is required');
  }

  if (!cloudRuntime) {
    logCloudDiagnostic('init:start', { envId: CLOUD_ENV_ID });

    try {
      wxRuntime.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: false
      });
    } catch (error) {
      logCloudDiagnostic('init:failure', {
        envId: CLOUD_ENV_ID,
        error: summarizeError(error)
      });
      throw error;
    }

    logCloudDiagnostic('init:success', { envId: CLOUD_ENV_ID });

    cloudRuntime = {
      mode: 'cloudbase',
      envId: CLOUD_ENV_ID
    };
  }

  return cloudRuntime;
}

function call(name, data = {}) {
  if (USE_LOCAL_MOCK) {
    return getLocalCloudClient().call(name, data);
  }

  initializeCloudRuntime();

  const wxRuntime = getWxRuntime();
  const startedAt = getNowMs();
  logCloudDiagnostic('call:start', { name });

  try {
    return wxRuntime.cloud.callFunction({
      name,
      data
    }).then(
      res => {
        logCloudDiagnostic('call:success', {
          name,
          elapsedMs: Math.round(getNowMs() - startedAt)
        });
        return res.result;
      },
      error => {
        logCloudDiagnostic('call:failure', {
          name,
          elapsedMs: Math.round(getNowMs() - startedAt),
          error: summarizeError(error)
        });
        throw error;
      }
    );
  } catch (error) {
    logCloudDiagnostic('call:failure', {
      name,
      elapsedMs: Math.round(getNowMs() - startedAt),
      error: summarizeError(error)
    });
    throw error;
  }
}

function uploadFile(filePath, cloudPath) {
  if (!filePath || filePath.startsWith('cloud://') || USE_LOCAL_MOCK) {
    return Promise.resolve(filePath || '');
  }

  initializeCloudRuntime();

  const wxRuntime = getWxRuntime();

  return wxRuntime.cloud
    .uploadFile({
      cloudPath,
      filePath
    })
    .then(res => res.fileID);
}

module.exports = {
  call,
  initializeCloudRuntime,
  uploadFile
};
