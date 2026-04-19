const { USE_LOCAL_MOCK, LOCAL_STORAGE_KEY } = require('../config/env');
const { buildStorageAdapter, createLocalCloudClient } = require('../mocks/local-cloud');

let localCloudClient = null;

function getLocalCloudClient() {
  if (!localCloudClient) {
    localCloudClient = createLocalCloudClient({
      storage: buildStorageAdapter(LOCAL_STORAGE_KEY),
      storageKey: LOCAL_STORAGE_KEY
    });
  }

  return localCloudClient;
}

function call(name, data = {}) {
  if (USE_LOCAL_MOCK) {
    return getLocalCloudClient().call(name, data);
  }

  return wx.cloud.callFunction({
    name,
    data
  }).then(res => res.result);
}

module.exports = {
  call
};
