jest.mock('../../../miniprogram/services/cloud', () => ({
  call: jest.fn()
}));

const { call } = require('../../../miniprogram/services/cloud');
const { resolvePhoneNumber } = require('../../../miniprogram/services/registration-service');

test('registration service keeps the phone authorization adapter for future extensions', () => {
  call.mockReturnValue(Promise.resolve({ phoneNumber: '13800000000' }));

  const result = resolvePhoneNumber('phone_code_123');

  expect(call).toHaveBeenCalledWith('resolvePhoneNumber', { code: 'phone_code_123' });
  expect(result).resolves.toEqual({ phoneNumber: '13800000000' });
});
