const fs = require('fs');
const path = require('path');

describe('activity detail actions', () => {
  test('renders organizer and signup cancellation action labels', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('Cancel Activity');
    expect(wxml).toContain('Cancel Signup');
  });
});
