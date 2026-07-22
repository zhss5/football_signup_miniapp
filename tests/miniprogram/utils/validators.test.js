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

  test('rejects invalid activity type values', () => {
    expect(() =>
      validateActivityDraft({
        title: 'Saturday 8-10',
        activityType: 'league',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        imageList: [],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toThrow('Invalid activity type');
  });

  test('rejects registration notice thresholds outside the total signup limit', () => {
    const draft = {
      title: 'Saturday 8-10',
      startAt: '2026-04-26T20:00:00.000Z',
      endAt: '2026-04-26T22:00:00.000Z',
      signupDeadlineAt: '2026-04-26T19:30:00.000Z',
      addressText: 'Half Stone',
      signupLimitTotal: 12,
      imageList: [],
      teams: [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ]
    };

    expect(() =>
      validateActivityDraft({
        ...draft,
        registrationNoticeThreshold: 0
      })
    ).toThrow('Registration notice threshold must be between 1 and total signup limit');

    expect(() =>
      validateActivityDraft({
        ...draft,
        registrationNoticeThreshold: 13
      })
    ).toThrow('Registration notice threshold must be between 1 and total signup limit');
  });

  test('rejects more than five detail images', () => {
    expect(() =>
      validateActivityDraft({
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        imageList: ['wxfile://cover-1.png'],
        detailImages: [
          'wxfile://detail-1.png',
          'wxfile://detail-2.png',
          'wxfile://detail-3.png',
          'wxfile://detail-4.png',
          'wxfile://detail-5.png',
          'wxfile://detail-6.png'
        ],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toThrow('Up to five detail images are supported');
  });

  test('rejects activity descriptions longer than 2000 characters', () => {
    expect(() =>
      validateActivityDraft({
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        description: 'a'.repeat(2001),
        signupLimitTotal: 12,
        imageList: [],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toThrow('Activity description supports up to 2000 characters');
  });

  test('accepts activity descriptions at the 2000 character limit', () => {
    expect(
      validateActivityDraft({
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        description: 'a'.repeat(2000),
        signupLimitTotal: 12,
        imageList: [],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toBe(true);
  });

  test.each([0, 6, 168])(
    'accepts late cancellation notice window %s',
    lateCancellationNoticeWindowHours => {
      expect(
        validateActivityDraft({
          title: 'Saturday 8-10',
          startAt: '2026-04-26T20:00:00.000Z',
          endAt: '2026-04-26T22:00:00.000Z',
          signupDeadlineAt: '2026-04-26T19:30:00.000Z',
          addressText: 'Half Stone',
          lateCancellationNoticeWindowHours,
          signupLimitTotal: 12,
          imageList: [],
          teams: [
            { teamName: 'White', maxMembers: 6 },
            { teamName: 'Red', maxMembers: 6 }
          ]
        })
      ).toBe(true);
    }
  );

  test.each([-1, 1.5, 169, 'six'])(
    'rejects invalid late cancellation notice window %p',
    lateCancellationNoticeWindowHours => {
      expect(() =>
        validateActivityDraft({
          title: 'Saturday 8-10',
          startAt: '2026-04-26T20:00:00.000Z',
          endAt: '2026-04-26T22:00:00.000Z',
          signupDeadlineAt: '2026-04-26T19:30:00.000Z',
          addressText: 'Half Stone',
          lateCancellationNoticeWindowHours,
          signupLimitTotal: 12,
          imageList: [],
          teams: [
            { teamName: 'White', maxMembers: 6 },
            { teamName: 'Red', maxMembers: 6 }
          ]
        })
      ).toThrow('Late cancellation notice window must be an integer between 0 and 168 hours');
    }
  );

  test.each([-1, 1.5])('rejects invalid explicit bench capacity %s', benchCapacity => {
    expect(() =>
      validateActivityDraft({
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        benchCapacity,
        signupLimitTotal: 12,
        imageList: [],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      })
    ).toThrow('Bench capacity must be a non-negative integer');
  });
});
