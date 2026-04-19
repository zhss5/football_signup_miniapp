const fs = require('fs');
const path = require('path');

describe('activity detail page hero', () => {
  test('renders the uploaded cover image when present', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('{{activity.coverImage}}');
  });
});
