const { USE_LOCAL_MOCK, CLOUD_ENV_ID } = require('./config/env');

App({
  onLaunch() {
    if (USE_LOCAL_MOCK) {
      return;
    }

    if (!wx.cloud) {
      throw new Error('Cloud capability is required');
    }

    const config = {
      traceUser: true
    };

    if (CLOUD_ENV_ID) {
      config.env = CLOUD_ENV_ID;
    }

    wx.cloud.init(config);
  }
});
