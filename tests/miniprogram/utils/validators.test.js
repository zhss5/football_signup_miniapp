const { validateActivityDraft } = require('../../../miniprogram/utils/validators');

describe('validateActivityDraft', () => {
  test('rejects missing title and teams', () => {
    expect(() =>
      validateActivityDraft({
        title: '',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        teams: []
      })
    ).toThrow('Activity title is required');
  });
});
