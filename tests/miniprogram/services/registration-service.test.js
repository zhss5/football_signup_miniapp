jest.mock('../../../miniprogram/services/cloud', () => ({
  call: jest.fn()
}));

const { call } = require('../../../miniprogram/services/cloud');
const {
  moveRegistration,
  resolvePhoneNumber,
  updateMyRegistrationProfile
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

test('registration service updates the caller registration profile through a dedicated API', () => {
  call.mockReturnValue(Promise.resolve({ signupName: 'New Name' }));
  const payload = {
    activityId: 'activity_1',
    signupName: 'New Name',
    avatarUrl: '',
    profileSource: 'manual',
    preferredPositions: ['门将']
  };

  const result = updateMyRegistrationProfile(payload);

  expect(call).toHaveBeenCalledWith('updateMyRegistrationProfile', payload);
  expect(result).resolves.toEqual({ signupName: 'New Name' });
});
