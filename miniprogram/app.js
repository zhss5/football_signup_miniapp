const { USE_LOCAL_MOCK, CLOUD_ENV_ID } = require('./config/env');
const { initializeLocale, setAppLocale, t } = require('./utils/i18n');

App({
  globalData: {
    locale: '',
    manualLocale: ''
  },

  onLaunch() {
    initializeLocale(this);

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
  },

  getLocale() {
    return this.globalData.locale;
  },

  setLocale(locale) {
    return setAppLocale(this, locale, { persist: true });
  },

  translate(key, params) {
    return t(key, params, this.globalData.locale);
  }
});
