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
  expect(form.teams).toEqual([
    {
      teamName: '队伍1',
      maxMembers: 12,
      colorKey: 'green'
    }
  ]);
  expect(form.insuranceLink).toBe('');
  expect(form.notificationHint).toBe('');
  expect(form.registrationNoticeThreshold).toBe(10);
  expect(form).not.toHaveProperty('requirePhone');
});

test('default teams include default color keys', () => {
  const form = createDefaultActivityForm();

  expect(form.teams[0]).toMatchObject({
    colorKey: 'green'
  });
  expect(form.shareImage).toBe('');
  expect(form.detailImages).toEqual([]);
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
    insuranceLink: ' https://insurance.example.com/apply ',
    notificationHint: ' 请提前10分钟到场 ',
    registrationNoticeThreshold: '16',
    coverImage: 'wxfile://cover-1.png',
    imageList: ['wxfile://cover-1.png']
  });

  expect(payload.insuranceLink).toBe('https://insurance.example.com/apply');
  expect(payload.notificationHint).toBe('请提前10分钟到场');
  expect(payload.registrationNoticeThreshold).toBe(16);
  expect(payload.coverImage).toBe('wxfile://cover-1.png');
  expect(payload.imageList).toEqual(['wxfile://cover-1.png']);
  expect(payload).not.toHaveProperty('requirePhone');
  expect(new Date(payload.startAt).getTime()).toBeLessThan(new Date(payload.endAt).getTime());
  expect(new Date(payload.signupDeadlineAt).getTime()).toBeLessThanOrEqual(new Date(payload.startAt).getTime());
});

test('buildActivityPayload defaults the registration notice threshold to 80 percent of capacity', () => {
  const payload = buildActivityPayload({
    ...createDefaultActivityForm(),
    signupLimitTotal: 20,
    registrationNoticeThreshold: ''
  });

  expect(payload.registrationNoticeThreshold).toBe(16);
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

test('buildActivityPayload preserves a generated share image separately from the cover', () => {
  const payload = buildActivityPayload({
    ...createDefaultActivityForm(),
    coverImage: 'wxfile://cover-1.jpg',
    coverThumbImage: 'wxfile://cover-1-thumb.jpg',
    shareImage: 'wxfile://cover-1-share.jpg',
    imageList: ['wxfile://cover-1.jpg']
  });

  expect(payload.coverImage).toBe('wxfile://cover-1.jpg');
  expect(payload.coverThumbImage).toBe('wxfile://cover-1-thumb.jpg');
  expect(payload.shareImage).toBe('wxfile://cover-1-share.jpg');
});

test('buildActivityPayload keeps up to five detail images separate from the cover', () => {
  const payload = buildActivityPayload({
    ...createDefaultActivityForm(),
    coverImage: 'wxfile://cover-1.jpg',
    imageList: ['wxfile://cover-1.jpg'],
    detailImages: [
      'wxfile://detail-1.jpg',
      '',
      'wxfile://detail-2.jpg',
      'wxfile://detail-3.jpg',
      'wxfile://detail-4.jpg',
      'wxfile://detail-5.jpg',
      'wxfile://detail-6.jpg'
    ]
  });

  expect(payload.imageList).toEqual(['wxfile://cover-1.jpg']);
  expect(payload.detailImages).toEqual([
    'wxfile://detail-1.jpg',
    'wxfile://detail-2.jpg',
    'wxfile://detail-3.jpg',
    'wxfile://detail-4.jpg',
    'wxfile://detail-5.jpg'
  ]);
});

test('buildActivityPayload preserves team color keys', () => {
  const payload = buildActivityPayload({
    ...createDefaultActivityForm(),
    teams: [
      {
        teamName: 'Team A',
        maxMembers: 12,
        colorKey: 'blue'
      }
    ]
  });

  expect(payload.teams[0]).toMatchObject({
    colorKey: 'blue'
  });
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
      insuranceLink: 'https://insurance.example.com/original',
      notificationHint: 'Bring both kits',
      registrationNoticeThreshold: 16,
      coverImage: 'cloud://cover-a',
      coverThumbImage: 'cloud://cover-a-thumb',
      detailImages: ['cloud://detail-a', 'cloud://detail-b'],
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
    insuranceLink: 'https://insurance.example.com/original',
    notificationHint: 'Bring both kits',
    registrationNoticeThreshold: 16,
    coverImage: 'cloud://cover-a',
    coverThumbImage: 'cloud://cover-a-thumb',
    detailImages: ['cloud://detail-a', 'cloud://detail-b'],
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
