const {
  buildActivityPayload,
  createDefaultActivityForm
} = require('../../../miniprogram/utils/activity-draft');

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
  expect(new Date(payload.startAt).getTime()).toBeLessThan(new Date(payload.endAt).getTime());
  expect(new Date(payload.signupDeadlineAt).getTime()).toBeLessThanOrEqual(new Date(payload.startAt).getTime());
});
