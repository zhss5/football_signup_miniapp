jest.mock('../../../miniprogram/services/cloud', () => ({
  call: jest.fn()
}));

const { call } = require('../../../miniprogram/services/cloud');
const {
  moveRegistration,
  resolvePhoneNumber
} = require('../../../miniprogram/services/registration-service');

test('registration service keeps the phone authorization adapter for future extensions', () => {
  call.mockReturnValue(Promise.resolve({ phoneNumber: '13800000000' }));

  const result = resolvePhoneNumber('phone_code_123');

  expect(call).toHaveBeenCalledWith('resolvePhoneNumber', { code: 'phone_code_123' });
  expect(result).resolves.toEqual({ phoneNumber: '13800000000' });
});

test('registration service can move a member to another team', () => {
  call.mockReturnValue(Promise.resolve({ moved: true }));

  const result = moveRegistration('activity_1', 'openid_player', 'team_red');

  expect(call).toHaveBeenCalledWith('moveRegistration', {
    activityId: 'activity_1',
    userOpenId: 'openid_player',
    targetTeamId: 'team_red'
  });
  expect(result).resolves.toEqual({ moved: true });
});
