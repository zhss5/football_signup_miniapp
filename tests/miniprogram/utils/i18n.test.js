const {
  DEFAULT_LOCALE,
  detectSystemLocale,
  getMessages,
  initializeLocale,
  normalizeLocale,
  t,
  translateErrorMessage
} = require('../../../miniprogram/utils/i18n');

describe('i18n utilities', () => {
  afterEach(() => {
    delete global.wx;
  });

  test('normalizes system language values into supported locales', () => {
    expect(normalizeLocale('zh_CN')).toBe('zh-CN');
    expect(normalizeLocale('zh-TW')).toBe('zh-CN');
    expect(normalizeLocale('en')).toBe('en-US');
    expect(normalizeLocale('fr-FR')).toBe('zh-CN');
  });

  test('defaults first-run app locale to Chinese even on an English system', () => {
    global.wx = {
      getStorageSync: jest.fn(() => ''),
      getAppBaseInfo: jest.fn(() => ({ language: 'en' })),
      getSystemInfoSync: jest.fn(() => ({ language: 'en' })),
      setTabBarItem: jest.fn()
    };
    const app = { globalData: {} };

    expect(DEFAULT_LOCALE).toBe('zh-CN');
    expect(initializeLocale(app)).toBe('zh-CN');
    expect(app.globalData.locale).toBe('zh-CN');
    expect(app.globalData.manualLocale).toBe('');
  });

  test('detects Chinese from system language and returns translated labels', () => {
    expect(detectSystemLocale('zh_CN')).toBe('zh-CN');
    expect(t('home.createActivity', {}, 'zh-CN')).toBe('创建活动');
    expect(t('activity.status.joinable', {}, 'zh-CN')).toBe('可报名');
  });

  test('fills missing locale branches from English defaults', () => {
    expect(getMessages('zh-CN').activityCreate.permissionChecking).toBe(
      'Checking create permission...'
    );
    expect(getMessages('zh-CN').nav.joinTeam).toBeTruthy();
  });

  test('provides Chinese copy for organizer edit labels', () => {
    const messages = getMessages('zh-CN');

    expect(messages.activity.actions.edit).toBe('\u7f16\u8f91\u6d3b\u52a8');
    expect(messages.nav.editActivity).toBe('\u7f16\u8f91\u6d3b\u52a8');
    expect(messages.activityCreate.saveChanges).toBe('\u4fdd\u5b58\u4fee\u6539');
  });

  test('provides Chinese copy for expired activities', () => {
    expect(t('activity.status.expired', {}, 'zh-CN')).toBe('\u6d3b\u52a8\u5df2\u8fc7\u671f');
  });

  test('provides the requested insurance purchase link label', () => {
    const messages = getMessages('zh-CN');

    expect(messages.activity.insurance.copyAction).toBe('\u4fdd\u9669\u8d2d\u4e70\u94fe\u63a5\ud83d\udd17');
  });

  test('translates the repeat signup block message to Chinese', () => {
    const message = translateErrorMessage(
      new Error('Too many repeat signups. Please contact the organizer'),
      (key, params) => t(key, params, 'zh-CN')
    );

    expect(message).toBe('\u91cd\u590d\u62a5\u540d\u6b21\u6570\u8fc7\u591a\uff0c\u8bf7\u8054\u7cfb\u7ec4\u7ec7\u8005');
  });

  test('translates wrapped CloudBase repeat signup errors to Chinese', () => {
    const message = translateErrorMessage(
      new Error(
        'cloud.callFunction:fail Error: errCode: -504002 functions execute fail | errMsg: Error: Too many repeat signups. Please contact the organizer'
      ),
      (key, params) => t(key, params, 'zh-CN')
    );

    expect(message).toBe('\u91cd\u590d\u62a5\u540d\u6b21\u6570\u8fc7\u591a\uff0c\u8bf7\u8054\u7cfb\u7ec4\u7ec7\u8005');
  });

  test('translates legacy wrapped contact-organizer errors as repeat signup blocks', () => {
    const message = translateErrorMessage(
      new Error(
        'cloud.callFunction:fail Error: errCode: -504002 functions execute fail | errMsg: Error: Please contact the organizer'
      ),
      (key, params) => t(key, params, 'zh-CN')
    );

    expect(message).toBe('\u91cd\u590d\u62a5\u540d\u6b21\u6570\u8fc7\u591a\uff0c\u8bf7\u8054\u7cfb\u7ec4\u7ec7\u8005');
  });

  test('translates wrapped team edit safety errors to Chinese', () => {
    const translate = (key, params) => t(key, params, 'zh-CN');

    expect(
      translateErrorMessage(
        new Error(
          'cloud.callFunction:fail Error: errCode: -504002 functions execute fail | errMsg: Error: Teams with joined members cannot be removed'
        ),
        translate
      )
    ).toBe('不能删除已有报名成员的队伍');
    expect(
      translateErrorMessage(
        new Error(
          'cloud.callFunction:fail Error: errCode: -504002 functions execute fail | errMsg: Error: Team capacity cannot be lower than joined members'
        ),
        translate
      )
    ).toBe('队伍人数不能低于已报名人数');
  });
});
