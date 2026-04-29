const {
  detectSystemLocale,
  getMessages,
  normalizeLocale,
  t
} = require('../../../miniprogram/utils/i18n');

describe('i18n utilities', () => {
  test('normalizes system language values into supported locales', () => {
    expect(normalizeLocale('zh_CN')).toBe('zh-CN');
    expect(normalizeLocale('zh-TW')).toBe('zh-CN');
    expect(normalizeLocale('en')).toBe('en-US');
    expect(normalizeLocale('fr-FR')).toBe('en-US');
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
});
