const fs = require('fs');
const path = require('path');

describe('activity detail actions', () => {
  test('renders organizer and signup cancellation action labels', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('{{i18n.activity.share.action}}');
    expect(wxml).toContain('{{i18n.activity.actions.edit}}');
    expect(wxml).toContain('{{i18n.activity.actions.cancelActivity}}');
    expect(wxml).toContain('{{i18n.activity.actions.cancelSignup}}');
    expect(wxml).toContain('open-type="share"');
    expect(wxml).toContain('wx:if="{{activity.addressName && activity.addressName !== activity.addressText}}"');
    expect(wxml).toContain('<map');
    expect(wxml).toContain('wx:if="{{locationMapVisible}}"');
    expect(wxml).toContain('markers="{{locationMapMarkers}}"');
    expect(wxml).toContain('bindmarkertap="onOpenLocation"');
    expect(wxml).toContain('<cover-view class="location-map-hitarea" bindtap="onOpenLocation" />');
    expect(wxml).toContain('bindtap="onOpenLocation"');
    expect(wxml).not.toContain('<signup-sheet');
  });
});
