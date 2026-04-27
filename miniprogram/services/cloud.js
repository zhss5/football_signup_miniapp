const { USE_LOCAL_MOCK, LOCAL_STORAGE_KEY, CLOUD_ENV_ID } = require('../config/env');
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
    wxRuntime.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    });

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

  return wxRuntime.cloud.callFunction({
    name,
    data
  }).then(res => res.result);
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
