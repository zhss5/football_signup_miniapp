const fs = require('fs');
const path = require('path');

describe('my activities page', () => {
  test('renders top tabs, created filters, and language switch bindings', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/my/index.wxml'),
      'utf8'
    );
    const js = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/my/index.js'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/my/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain('onTabChange');
    expect(wxml).toContain('onCreatedFilterTap');
    expect(wxml).toContain('onLanguageChange');
    expect(wxml).toContain('primary-tab-shell');
    expect(wxml).toContain('filter-heading');
    expect(js).toContain("activeTab: 'created'");
    expect(js).toContain("languageOptions:");
    expect(js).toContain("locale:");
    expect(js).toContain('filterLabel');
    expect(wxss).toContain('.primary-tab-shell');
    expect(wxss).toContain('.filter-group');
    expect(wxml).not.toContain('<text class="section-title">Joined Activities</text>');
  });
});
