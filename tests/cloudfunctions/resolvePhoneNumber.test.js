const resolvePhoneNumber = require('../../cloudfunctions/resolvePhoneNumber/index');

test('resolvePhoneNumber exchanges a WeChat authorization code for a phone number', async () => {
  const exchange = jest.fn().mockResolvedValue({
    phoneNumber: '13800000000',
    purePhoneNumber: '13800000000',
    countryCode: '86'
  });

  await expect(
    resolvePhoneNumber.main(
      {
        code: 'phone_code_123'
      },
      {},
      {
        resolvePhoneNumber: exchange
      }
    )
  ).resolves.toEqual({
    phoneNumber: '13800000000',
    purePhoneNumber: '13800000000',
    countryCode: '86',
    phoneSource: 'wechat'
  });

  expect(exchange).toHaveBeenCalledWith('phone_code_123');
});

test('resolvePhoneNumber rejects missing authorization codes', async () => {
  await expect(
    resolvePhoneNumber.main(
      {},
      {},
      {
        resolvePhoneNumber: jest.fn()
      }
    )
  ).rejects.toThrow('Phone authorization code is required');
});
