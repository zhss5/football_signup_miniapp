const { initializeCloudRuntime } = require('./services/cloud');
const { initializeLocale, setAppLocale, t } = require('./utils/i18n');

App({
  globalData: {
    locale: '',
    manualLocale: ''
  },

  onLaunch() {
    initializeLocale(this);
    initializeCloudRuntime();
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
