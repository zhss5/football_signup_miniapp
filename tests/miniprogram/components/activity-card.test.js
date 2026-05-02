const fs = require('fs');
const path = require('path');

describe('activity card component', () => {
  test('does not use raw cover file ids as image sources', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/activity-card/index.wxml'),
      'utf8'
    );

    expect(wxml).not.toContain('src="{{item.coverImage}}"');
  });

  test('renders only the resolved display cover url', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/activity-card/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{activeCoverImage || item.coverImage}}"');
    expect(wxml).toContain('wx:if="{{activeCoverImage && !coverLoadFailed}}"');
    expect(wxml).toContain('src="{{activeCoverImage}}"');
    expect(wxml).not.toContain('src="{{item.coverDisplayImage || item.coverImage}}"');
  });

  test('lazy loads cover images and falls back to backup sources when loading fails', () => {
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

    expect(wxml).toContain('lazy-load="{{true}}"');
    expect(wxml).toContain('binderror="onCoverError"');
    expect(wxml).toContain('coverLoadFailed');
    expect(js).toContain('coverCandidates');
    expect(js).toContain('coverSourceIndex');
    expect(js).toContain('onCoverError');
    expect(wxss).toContain('.cover-placeholder');
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
