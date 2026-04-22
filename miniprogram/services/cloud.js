const { USE_LOCAL_MOCK, LOCAL_STORAGE_KEY, CLOUD_ENV_ID } = require('../config/env');
const { buildStorageAdapter, createLocalCloudClient } = require('../mocks/local-cloud');

let localCloudClient = null;
let cloudRuntime = null;

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

  if (!global.wx || !global.wx.cloud) {
    throw new Error('Cloud capability is required');
  }

  if (!cloudRuntime) {
    global.wx.cloud.init({
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

  return wx.cloud.callFunction({
    name,
    data
  }).then(res => res.result);
}

module.exports = {
  call,
  initializeCloudRuntime
};
