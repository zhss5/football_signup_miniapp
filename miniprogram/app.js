const { initializeCloudRuntime } = require('./services/cloud');
const { ENABLE_CLOUD_DIAGNOSTICS } = require('./config/env');
const { initializeLocale, setAppLocale, t } = require('./utils/i18n');

function formatErrorText(error) {
  if (!error) {
    return '';
  }

  return error.message || error.errMsg || String(error);
}

function logAppDiagnostic(event, details) {
  if (!ENABLE_CLOUD_DIAGNOSTICS || typeof console === 'undefined' || !console.info) {
    return;
  }

  console.info(`[app] ${event}`, details || {});
}

App({
  globalData: {
    locale: '',
    manualLocale: ''
  },

  onLaunch() {
    initializeLocale(this);
    initializeCloudRuntime();
  },

  onError(error) {
    logAppDiagnostic('onError', {
      errorText: formatErrorText(error)
    });
  },

  onUnhandledRejection(event = {}) {
    logAppDiagnostic('onUnhandledRejection', {
      errorText: formatErrorText(event.reason || event)
    });
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
