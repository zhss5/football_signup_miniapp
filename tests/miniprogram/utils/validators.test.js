const { validateActivityDraft } = require('../../../miniprogram/utils/validators');

describe('validateActivityDraft', () => {
  test('rejects missing title and teams', () => {
    expect(() =>
      validateActivityDraft({
        title: '',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        imageList: [],
        teams: []
      })
    ).toThrow('Activity title is required');
  });

  test('rejects total signup limit smaller than team capacity', () => {
    expect(() =>
      validateActivityDraft({
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 10,
        imageList: [],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toThrow('Total signup limit must cover all team slots');
  });

  test('rejects signup deadline later than activity start time', () => {
    expect(() =>
      validateActivityDraft({
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T20:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        imageList: [],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toThrow('Signup deadline must be earlier than or equal to activity start time');
  });

  test('rejects end time earlier than or equal to start time', () => {
    expect(() =>
      validateActivityDraft({
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T20:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        imageList: [],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toThrow('Activity end time must be later than start time');
  });

  test('rejects more than one activity image in MVP mode', () => {
    expect(() =>
      validateActivityDraft({
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        imageList: ['wxfile://cover-1.png', 'wxfile://cover-2.png'],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toThrow('Only one activity image is supported right now');
  });
});
