const fs = require('fs');
const path = require('path');

describe('activity create validation styles', () => {
  test('location input can render the error highlight state', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain("validationErrors.addressText ? 'input-error' : ''");
    expect(wxss).toContain('.input-error');
    expect(wxss).toContain('border: 2rpx solid #dc2626');
  });
});
