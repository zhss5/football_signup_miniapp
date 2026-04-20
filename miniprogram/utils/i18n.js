const enUS = require('../locales/en-US');
const zhCN = require('../locales/zh-CN');

const DEFAULT_LOCALE = 'en-US';
const LOCALE_STORAGE_KEY = 'football-signup-locale';
const SUPPORTED_LOCALES = {
  'en-US': enUS,
  'zh-CN': zhCN
};

function normalizeLocale(locale) {
  const normalized = String(locale || '').replace('_', '-').toLowerCase();

  if (normalized.startsWith('zh')) {
    return 'zh-CN';
  }

  if (normalized.startsWith('en')) {
    return 'en-US';
  }

  return DEFAULT_LOCALE;
}

function detectSystemLocale(explicitLanguage) {
  if (explicitLanguage) {
    return normalizeLocale(explicitLanguage);
  }

  try {
    if (typeof wx !== 'undefined' && typeof wx.getAppBaseInfo === 'function') {
      const info = wx.getAppBaseInfo();
      if (info && info.language) {
        return normalizeLocale(info.language);
      }
    }
  } catch (error) {
    // ignore and fall back
  }

  try {
    if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
      const info = wx.getSystemInfoSync();
      if (info && info.language) {
        return normalizeLocale(info.language);
      }
    }
  } catch (error) {
    // ignore and fall back
  }

  return DEFAULT_LOCALE;
}

function getMessages(locale = DEFAULT_LOCALE) {
  return SUPPORTED_LOCALES[normalizeLocale(locale)] || enUS;
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (full, key) => {
    return Object.prototype.hasOwnProperty.call(params, key) ? params[key] : '';
  });
}

function resolveMessage(key, locale) {
  return key.split('.').reduce((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    return current[segment];
  }, getMessages(locale));
}

function t(key, params = {}, locale = DEFAULT_LOCALE) {
  const template = resolveMessage(key, locale);

  if (typeof template !== 'string') {
    return key;
  }

  return interpolate(template, params);
}

function makeTranslator(locale = DEFAULT_LOCALE) {
  return (key, params) => t(key, params, locale);
}

function getStoredLocale() {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') {
    return '';
  }

  try {
    return normalizeLocale(wx.getStorageSync(LOCALE_STORAGE_KEY) || '');
  } catch (error) {
    return '';
  }
}

function persistLocale(locale) {
  if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
    return;
  }

  try {
    wx.setStorageSync(LOCALE_STORAGE_KEY, normalizeLocale(locale));
  } catch (error) {
    // ignore storage failures
  }
}

function clearStoredLocale() {
  if (typeof wx === 'undefined' || typeof wx.removeStorageSync !== 'function') {
    return;
  }

  try {
    wx.removeStorageSync(LOCALE_STORAGE_KEY);
  } catch (error) {
    // ignore storage failures
  }
}

function applyTabBarLocale(locale) {
  if (typeof wx === 'undefined' || typeof wx.setTabBarItem !== 'function') {
    return;
  }

  wx.setTabBarItem({
    index: 0,
    text: t('common.home', {}, locale)
  });
  wx.setTabBarItem({
    index: 1,
    text: t('common.my', {}, locale)
  });
}

function initializeLocale(app) {
  const manualLocale = getStoredLocale();
  const locale = manualLocale || detectSystemLocale();

  if (app) {
    app.globalData = {
      ...(app.globalData || {}),
      locale,
      manualLocale: manualLocale || ''
    };
  }

  applyTabBarLocale(locale);
  return locale;
}

function setAppLocale(app, locale, options = {}) {
  const nextLocale = normalizeLocale(locale);
  const persist = options.persist !== false;

  if (app) {
    app.globalData = {
      ...(app.globalData || {}),
      locale: nextLocale,
      manualLocale: persist ? nextLocale : ''
    };
  }

  if (persist) {
    persistLocale(nextLocale);
  } else {
    clearStoredLocale();
  }

  applyTabBarLocale(nextLocale);
  return nextLocale;
}

function getAppLocale() {
  if (typeof getApp === 'function') {
    const app = getApp();
    if (app && app.globalData && app.globalData.locale) {
      return app.globalData.locale;
    }
  }

  return getStoredLocale() || detectSystemLocale();
}

function setPageNavigationTitle(titleKey, locale, params) {
  if (typeof wx === 'undefined' || typeof wx.setNavigationBarTitle !== 'function') {
    return;
  }

  wx.setNavigationBarTitle({
    title: t(titleKey, params, locale)
  });
}

function buildLanguageOptions(locale) {
  const currentLocale = normalizeLocale(locale);

  return ['en-US', 'zh-CN'].map(item => ({
    key: item,
    label: t(`languageOptions.${item}`, {}, currentLocale)
  }));
}

function translateErrorMessage(error, translate) {
  const mapping = {
    'Activity title is required': 'errors.activityTitleRequired',
    'Activity address is required': 'errors.activityAddressRequired',
    'Activity start time is required': 'errors.activityStartTimeRequired',
    'Activity end time is required': 'errors.activityEndTimeRequired',
    'Signup deadline is required': 'errors.signupDeadlineRequired',
    'Activity end time must be later than start time': 'errors.activityEndTimeOrder',
    'Signup deadline must be earlier than or equal to activity start time': 'errors.signupDeadlineOrder',
    'Total signup limit is required': 'errors.totalSignupLimitRequired',
    'Only one activity image is supported right now': 'errors.onlyOneActivityImage',
    'At least one team is required': 'errors.atLeastOneTeamRequired',
    'Too many teams': 'errors.tooManyTeams',
    'Team name is required': 'errors.teamNameRequired',
    'Team capacity must be greater than 0': 'errors.teamCapacityRequired',
    'Total signup limit must cover all team slots': 'errors.totalSignupLimitCoverTeams',
    'Signup name is required': 'errors.signupNameRequired',
    'Phone is required': 'errors.phoneRequired',
    'Activity not found': 'errors.activityNotFound',
    'Activity is not open for signup': 'errors.activityNotOpen',
    'Signup is closed': 'errors.signupClosed',
    'Team not found': 'errors.teamNotFound',
    'Activity is full': 'errors.activityFull',
    'Team is full': 'errors.teamFull',
    'You already joined this activity': 'errors.alreadyJoined',
    'No active registration to cancel': 'errors.noActiveRegistration',
    'Signup can no longer be cancelled': 'errors.signupCannotBeCancelled',
    'Only the organizer can cancel this activity': 'errors.organizerCancelOnly',
    'Only the organizer can delete this activity': 'errors.organizerDeleteOnly',
    'Only activities without joined players can be deleted': 'errors.deleteOnlyEmpty'
  };

  const message = error && error.message ? error.message : '';
  const key = mapping[message];

  if (!key) {
    return message;
  }

  return translate(key);
}

module.exports = {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  applyTabBarLocale,
  buildLanguageOptions,
  detectSystemLocale,
  getAppLocale,
  getMessages,
  getStoredLocale,
  initializeLocale,
  makeTranslator,
  normalizeLocale,
  setAppLocale,
  setPageNavigationTitle,
  t,
  translateErrorMessage
};
