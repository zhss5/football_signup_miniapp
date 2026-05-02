const {
  MAX_SIGNUP_NAME_LENGTH,
  normalizeSignupName
} = require('../../../miniprogram/utils/signup-name');

describe('signup name normalization', () => {
  test('trims edges, replaces line breaks, and keeps emoji and common symbols', () => {
    expect(normalizeSignupName('  张\n虹生😀\r\nA.B  ')).toBe('张 虹生😀 A.B');
  });

  test('limits names to sixteen visible code points', () => {
    const normalized = normalizeSignupName('12345678901234567890');

    expect(MAX_SIGNUP_NAME_LENGTH).toBe(16);
    expect(normalized).toBe('1234567890123456');
    expect(Array.from(normalized)).toHaveLength(MAX_SIGNUP_NAME_LENGTH);
  });

  test('returns an empty string for whitespace-only input', () => {
    expect(normalizeSignupName('\n\t  ')).toBe('');
  });
});
