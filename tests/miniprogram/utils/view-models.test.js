const { buildActivityCardVm } = require('../../../miniprogram/utils/formatters');

test('buildActivityCardVm marks full activities', () => {
  const vm = buildActivityCardVm({
    title: 'Saturday 8-10',
    joinedCount: 12,
    signupLimitTotal: 12,
    status: 'published'
  });

  expect(vm.statusText).toBe('Full');
});
