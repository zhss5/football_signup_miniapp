const fs = require('fs');
const path = require('path');

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '../../../', relativePath), 'utf8');
}

describe('activity cover crop flow', () => {
  test('registers the dedicated crop page in the mini program', () => {
    const appJson = JSON.parse(readFile('miniprogram/app.json'));

    expect(appJson.pages).toContain('pages/activity-cover-crop/index');
  });

  test('create activity routes picked images into the crop page before saving', () => {
    const content = readFile('miniprogram/pages/activity-create/index.js');

    expect(content).toContain('/pages/activity-cover-crop/index');
    expect(content).toContain('encodeURIComponent(imagePath)');
    expect(content).toContain('coverCropped');
  });

  test('crop page shows the full image stage, a visible selection frame, and confirmation controls', () => {
    const wxml = readFile('miniprogram/pages/activity-cover-crop/index.wxml');

    expect(wxml).toContain('image-stage');
    expect(wxml).toContain('selection-frame');
    expect(wxml).toContain('{{i18n.coverCrop.controls.panX}}');
    expect(wxml).toContain('{{i18n.coverCrop.actions.confirm}}');
  });
});
