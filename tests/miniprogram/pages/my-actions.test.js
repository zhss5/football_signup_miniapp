const fs = require('fs');
const path = require('path');

describe('my activities page', () => {
  test('renders top tabs and keeps created filters under the created tab', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/my/index.wxml'),
      'utf8'
    );
    const js = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/my/index.js'),
      'utf8'
    );

    expect(wxml).toContain('Cancel Activity');
    expect(wxml).toContain('Delete');
    expect(wxml).toContain('onTabChange');
    expect(wxml).toContain('onCreatedFilterTap');
    expect(js).toContain("activeTab: 'created'");
    expect(js).toContain("label: 'Created'");
    expect(js).toContain("label: 'Joined'");
    expect(js).toContain("label: 'All'");
    expect(js).toContain("label: 'Active'");
    expect(js).toContain("label: 'Cancelled'");
    expect(js).toContain("label: 'Deleted'");
    expect(wxml).not.toContain('<text class="section-title">Joined Activities</text>');
  });
});
