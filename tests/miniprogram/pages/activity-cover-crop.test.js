const fs = require('fs');
const path = require('path');
const {
  COVER_OUTPUT_HEIGHT,
  COVER_OUTPUT_QUALITY,
  COVER_OUTPUT_WIDTH,
  SHARE_OUTPUT_HEIGHT,
  SHARE_OUTPUT_WIDTH,
  COVER_THUMB_OUTPUT_HEIGHT,
  COVER_THUMB_OUTPUT_QUALITY,
  COVER_THUMB_OUTPUT_WIDTH
} = require('../../../miniprogram/utils/cover-crop');

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

  test('exports a compressed jpeg before uploading the activity cover', () => {
    const pageJs = readFile('miniprogram/pages/activity-cover-crop/index.js');

    expect(COVER_OUTPUT_QUALITY).toBeLessThanOrEqual(0.8);
    expect(pageJs).toContain('quality: COVER_OUTPUT_QUALITY');
    expect(pageJs).toContain("fileType: 'jpg'");
  });

  test('exports the cover and share image in the same 5:4 ratio', () => {
    expect(COVER_OUTPUT_WIDTH / COVER_OUTPUT_HEIGHT).toBeCloseTo(1.25, 5);
    expect(SHARE_OUTPUT_WIDTH / SHARE_OUTPUT_HEIGHT).toBeCloseTo(1.25, 5);
    expect(COVER_OUTPUT_WIDTH).toBe(SHARE_OUTPUT_WIDTH);
    expect(COVER_OUTPUT_HEIGHT).toBe(SHARE_OUTPUT_HEIGHT);
  });

  test('exports a smaller compressed thumbnail together with the cover image', () => {
    const pageJs = readFile('miniprogram/pages/activity-cover-crop/index.js');

    expect(COVER_THUMB_OUTPUT_WIDTH).toBeLessThan(COVER_OUTPUT_WIDTH);
    expect(COVER_THUMB_OUTPUT_HEIGHT).toBeLessThan(COVER_OUTPUT_HEIGHT);
    expect(COVER_THUMB_OUTPUT_QUALITY).toBeLessThanOrEqual(COVER_OUTPUT_QUALITY);
    expect(pageJs).toContain('thumbTempFilePath');
    expect(pageJs).toContain('COVER_THUMB_OUTPUT_WIDTH');
    expect(pageJs).toContain('COVER_THUMB_OUTPUT_HEIGHT');
  });

  test('confirm emits a share image path with the cropped cover result', async () => {
    let pageConfig;
    const emitted = {};
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      navigateBack: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/activity-cover-crop/index');

    const ctx = {
      ...pageConfig,
      data: {
        ready: true,
        processing: false
      },
      openerEventChannel: {
        emit: jest.fn((name, payload) => {
          emitted[name] = payload;
        })
      },
      exportCroppedImages: jest.fn().mockResolvedValue({
        tempFilePath: 'wxfile://cover.jpg',
        thumbTempFilePath: 'wxfile://thumb.jpg',
        shareTempFilePath: 'wxfile://share.jpg'
      }),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onConfirm.call(ctx);

    expect(emitted.coverCropped).toMatchObject({
      tempFilePath: 'wxfile://cover.jpg',
      thumbTempFilePath: 'wxfile://thumb.jpg',
      shareTempFilePath: 'wxfile://share.jpg',
      imageList: ['wxfile://cover.jpg']
    });
  });
});
