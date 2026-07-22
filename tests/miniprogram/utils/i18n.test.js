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

  test('provides Chinese copy for notification settings fields', () => {
    const messages = getMessages('zh-CN');

    expect(messages.activityCreate.notificationSettings).toBe('\u901a\u77e5\u8bbe\u7f6e');
    expect(messages.activityCreate.notificationSettingsHint).toBe(
      '\u4ec5\u7528\u4e8e\u901a\u77e5\u6d88\u606f\uff0c\u4e0d\u4f1a\u5c55\u793a\u5728\u6d3b\u52a8\u8be6\u60c5\u9875\u3002'
    );
    expect(messages.activityCreate.notificationHint).toBe(
      '\u6d3b\u52a8\u4e3e\u884c\u901a\u77e5\u6e29\u99a8\u63d0\u793a'
    );
    expect(messages.activityCreate.lateCancellationNoticeWindowHours).toBe(
      '\u4e34\u8fd1\u53d6\u6d88\u901a\u77e5\uff08\u5c0f\u65f6\uff09'
    );
    expect(messages.activityCreate.lateCancellationNoticeWindowHoursHint).toContain(
      '\u8bbe\u4e3a 0 \u8868\u793a\u5173\u95ed'
    );
    expect(messages.errors.lateCancellationNoticeWindowHoursRange).toBe(
      '\u4e34\u8fd1\u53d6\u6d88\u901a\u77e5\u5c0f\u65f6\u6570\u5fc5\u987b\u662f 0 \u5230 168 \u4e4b\u95f4\u7684\u6574\u6570'
    );
  });

  test('translates the cloud cancellation notice window validation error', () => {
    const message = translateErrorMessage(
      new Error('Late cancellation notice window must be an integer between 0 and 168 hours'),
      (key, params) => t(key, params, 'zh-CN')
    );

    expect(message).toBe('临近取消通知小时数必须是 0 到 168 之间的整数');
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

  test('translates automatic bench queue move errors to Chinese', () => {
    const message = translateErrorMessage(
      new Error('Bench registrations are managed automatically'),
      (key, params) => t(key, params, 'zh-CN')
    );

    expect(message).toBe('替补队列由系统自动管理');
  });

  test('translates self registration profile edit errors to Chinese', () => {
    const translate = (key, params) => t(key, params, 'zh-CN');

    expect(
      translateErrorMessage(
        new Error('Registration profile is locked after activity start'),
        translate
      )
    ).toBe('活动开始后不能修改报名信息');
    expect(translateErrorMessage(new Error('Registration not found'), translate)).toBe(
      '未找到当前报名记录'
    );
    expect(
      translateErrorMessage(new Error('Only joined registrations can be edited'), translate)
    ).toBe('只有有效报名可以修改');
    expect(
      translateErrorMessage(new Error('Proxy registrations cannot be edited'), translate)
    ).toBe('代报名不能作为个人报名资料修改');
  });
});
