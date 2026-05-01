const {
  buildActivityEditForm,
  buildActivityPayload,
  createDefaultActivityForm
} = require('../../../miniprogram/utils/activity-draft');

test('createDefaultActivityForm defaults activity and signup deadline dates to tomorrow', () => {
  const form = createDefaultActivityForm({
    now: () => new Date('2026-04-28T10:00:00+08:00')
  });

  expect(form.activityDate).toBe('2026-04-29');
  expect(form.signupDeadlineDate).toBe('2026-04-29');
  expect(form).not.toHaveProperty('requirePhone');
});

test('buildActivityPayload composes activity times and keeps a single uploaded image list', () => {
  const payload = buildActivityPayload({
    ...createDefaultActivityForm(),
    title: 'Saturday 8-10',
    activityDate: '2026-04-26',
    startTime: '20:00',
    endTime: '22:00',
    signupDeadlineDate: '2026-04-26',
    signupDeadlineTime: '19:30',
    addressText: 'Half Stone',
    coverImage: 'wxfile://cover-1.png',
    imageList: ['wxfile://cover-1.png']
  });

  expect(payload.coverImage).toBe('wxfile://cover-1.png');
  expect(payload.imageList).toEqual(['wxfile://cover-1.png']);
  expect(payload).not.toHaveProperty('requirePhone');
  expect(new Date(payload.startAt).getTime()).toBeLessThan(new Date(payload.endAt).getTime());
  expect(new Date(payload.signupDeadlineAt).getTime()).toBeLessThanOrEqual(new Date(payload.startAt).getTime());
});

test('buildActivityPayload preserves a generated cover thumbnail', () => {
  const payload = buildActivityPayload({
    ...createDefaultActivityForm(),
    coverImage: 'wxfile://cover-1.jpg',
    coverThumbImage: 'wxfile://cover-1-thumb.jpg',
    imageList: ['wxfile://cover-1.jpg']
  });

  expect(payload.coverImage).toBe('wxfile://cover-1.jpg');
  expect(payload.coverThumbImage).toBe('wxfile://cover-1-thumb.jpg');
});

test('buildActivityEditForm maps an existing activity detail into the create form shape', () => {
  const startAt = new Date(2026, 3, 26, 20, 0).toISOString();
  const endAt = new Date(2026, 3, 26, 22, 0).toISOString();
  const signupDeadlineAt = new Date(2026, 3, 26, 19, 30).toISOString();

  const form = buildActivityEditForm(
    {
      title: 'Original Match',
      startAt,
      endAt,
      signupDeadlineAt,
      addressText: 'Old address',
      addressName: 'Old field',
      location: {
        latitude: 31.2,
        longitude: 121.4
      },
      description: 'Original notes',
      coverImage: 'cloud://cover-a',
      coverThumbImage: 'cloud://cover-a-thumb',
      imageList: ['cloud://cover-a'],
      signupLimitTotal: 20,
      requirePhone: true,
      inviteCode: 'ABC'
    },
    [
      { teamName: 'White', maxMembers: 6, teamType: 'regular', status: 'active' },
      { teamName: 'Red', maxMembers: 6, teamType: 'regular', status: 'active' },
      { teamName: 'Bench', maxMembers: 8, teamType: 'bench', status: 'active' }
    ]
  );

  expect(form).toMatchObject({
    title: 'Original Match',
    activityDate: '2026-04-26',
    startTime: '20:00',
    endTime: '22:00',
    signupDeadlineDate: '2026-04-26',
    signupDeadlineTime: '19:30',
    addressText: 'Old address',
    addressName: 'Old field',
    description: 'Original notes',
    coverImage: 'cloud://cover-a',
    coverThumbImage: 'cloud://cover-a-thumb',
    imageList: ['cloud://cover-a'],
    signupLimitTotal: 20,
    inviteCode: 'ABC',
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ]
  });
  expect(form).not.toHaveProperty('requirePhone');
});
