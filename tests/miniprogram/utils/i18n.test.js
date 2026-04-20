const {
  detectSystemLocale,
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
});
