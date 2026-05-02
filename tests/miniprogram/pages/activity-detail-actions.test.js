const fs = require('fs');
const path = require('path');

describe('activity detail actions', () => {
  test('renders organizer and signup cancellation action labels', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('{{i18n.activity.share.action}}');
    expect(wxml).toContain('src="{{activity.coverDisplayImage}}"');
    expect(wxml).toContain('{{i18n.activity.actions.edit}}');
    expect(wxml).toContain('{{i18n.activity.actions.copyParticipantNames}}');
    expect(wxml).toContain('bindtap="onCopyParticipantNames"');
    expect(wxml).toContain('{{i18n.activity.status.confirmed}}');
    expect(wxml).toContain('bindtap="onConfirmActivityProceeding"');
    expect(wxml).toContain('{{i18n.activity.actions.confirmProceeding}}');
    expect(wxml).toContain('{{i18n.activity.actions.cancelActivity}}');
    expect(wxml).toContain('bind:proxysignup="onProxySignup"');
    expect(wxml).toContain('bind:removemember="onRemoveRegistration"');
    expect(wxml).toContain('bind:cancelsignup="onCancelSignup"');
    expect(wxml).toContain('open-type="share"');
    expect(wxml).toContain('wx:if="{{activity.addressName && activity.addressName !== activity.addressText}}"');
    expect(wxml).toContain('<map');
    expect(wxml).toContain('wx:if="{{locationMapVisible}}"');
    expect(wxml).toContain('markers="{{locationMapMarkers}}"');
    expect(wxml).toContain('bindmarkertap="onOpenLocation"');
    expect(wxml).toContain('<view wx:if="{{locationMapVisible}}" class="location-map-wrap">');
    expect(wxml).toContain('<map');
    expect(wxml).toContain('<cover-view class="location-map-hitarea" bindtap="onOpenLocation"></cover-view>');
    expect(wxml).toContain('bindtap="onOpenLocation"');
    expect(wxml).toContain(
      '<button wx:if="{{activity.insuranceLink}}" class="insurance-link-button" bindtap="onOpenInsuranceLink">'
    );
    expect(wxml.indexOf('class="share-card')).toBeLessThan(
      wxml.indexOf('class="insurance-link-button"')
    );
    expect(wxml.indexOf('class="insurance-link-button"')).toBeLessThan(
      wxml.indexOf('class="share-title"')
    );
    expect(wxml).not.toContain('class="insurance-card"');
    expect(wxml).not.toContain('wx:if="{{viewer && viewer.canCancelSignup}}"');
    expect(wxml).not.toContain('<signup-sheet');
  });

  test('constrains the native map preview so it cannot widen the detail page', () => {
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-detail/index.wxss'),
      'utf8'
    );

    expect(wxss).toContain('box-sizing: border-box');
    expect(wxss).toContain('overflow-x: hidden');
    expect(wxss).toContain('.location-row');
    expect(wxss).toContain('max-width: 100%');
  });
});
