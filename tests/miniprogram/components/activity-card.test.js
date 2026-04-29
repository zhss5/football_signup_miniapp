const fs = require('fs');
const path = require('path');

describe('activity card component', () => {
  test('renders the uploaded cover image when present', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/activity-card/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('{{item.coverImage}}');
  });

  test('renders the activity start time and joined versus total capacity text', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/activity-card/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('{{item.startDisplayText}}');
    expect(wxml).toContain('{{item.capacityText}}');
  });

  test('supports embedded rendering when a parent card owns the outer frame', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/activity-card/index.wxml'),
      'utf8'
    );
    const js = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/activity-card/index.js'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/activity-card/index.wxss'),
      'utf8'
    );

    expect(js).toContain('embedded');
    expect(wxml).toContain("{{embedded ? 'card-embedded' : ''}}");
    expect(wxss).toContain('.card-embedded');
  });
});
