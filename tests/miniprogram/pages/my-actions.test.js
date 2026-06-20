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
    expect(wxml).toContain('created-activity-card');
    expect(wxml).toContain('activity-action-footer');
    expect(wxml).not.toContain('overdue-unresolved-panel');
    expect(wxml).not.toContain('overdueUnresolved');
    expect(wxml).not.toContain('catchtap="onConfirmActivityProceeding"');
    expect(wxml).not.toContain('catchtap="onCancelActivity"');
    expect(wxml).toContain('bindtap="loadMoreMyActivities"');
    expect(wxml).toContain('web-admin-login-card');
    expect(wxml).toContain('bindtap="onConfirmWebAdminLogin"');
    expect(wxml.indexOf('activity-action-footer')).toBeGreaterThan(
      wxml.indexOf('created-activity-card')
    );
    expect(js).toContain("activeTab: 'created'");
    expect(js).toContain("languageOptions:");
    expect(js).toContain("locale:");
    expect(js).toContain('filterLabel');
    expect(js).not.toContain('isOverdueUnresolvedActivity');
    expect(js).not.toContain('overdueUnresolved');
    expect(js).not.toContain('onConfirmActivityProceeding');
    expect(js).not.toContain('onCancelActivity');
    expect(wxss).toContain('.primary-tab-shell');
    expect(wxss).toContain('.filter-group');
    expect(wxss).toContain('.created-activity-card');
    expect(wxss).toContain('.activity-action-footer');
    expect(wxss).not.toContain('.overdue-unresolved-panel');
    expect(wxss).toContain('.web-admin-login-card');
    expect(wxss).toContain('.pagination-row');
    expect(wxml).not.toContain('<text class="section-title">Joined Activities</text>');
  });

  test('keeps user id logic without rendering the user id panel', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/my/index.wxml'),
      'utf8'
    );
    const js = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/my/index.js'),
      'utf8'
    );

    expect(wxml).not.toContain('identity-card');
    expect(wxml).not.toContain('{{userOpenId}}');
    expect(wxml).not.toContain('bindtap="onCopyUserId"');
    expect(js).toContain('userOpenId');
    expect(js).toContain('onCopyUserId()');
  });
});
