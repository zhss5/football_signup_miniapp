const {
  COVER_ASPECT_RATIO,
  buildCropRect,
  buildInitialCropModel,
  buildStageOverlayStyles
} = require('../../../miniprogram/utils/cover-crop');

test('buildInitialCropModel creates a centered 2:1 crop window for portrait images', () => {
  const model = buildInitialCropModel({ width: 1200, height: 1800 });

  expect(model.zoomPercent).toBe(100);
  expect(model.panXPercent).toBe(50);
  expect(model.panYPercent).toBe(50);

  const rect = buildCropRect(model);
  expect(rect.width / rect.height).toBeCloseTo(COVER_ASPECT_RATIO, 5);
  expect(rect.x).toBe(0);
  expect(rect.y).toBe(600);
  expect(rect.width).toBe(1200);
  expect(rect.height).toBe(600);
});

test('buildCropRect shrinks the crop window when zooming and keeps it within bounds', () => {
  const rect = buildCropRect(
    buildInitialCropModel({ width: 2000, height: 1000 }),
    { zoomPercent: 200, panXPercent: 100, panYPercent: 0 }
  );

  expect(rect.width).toBe(1000);
  expect(rect.height).toBe(500);
  expect(rect.x).toBe(1000);
  expect(rect.y).toBe(0);
});

test('buildStageOverlayStyles keeps the whole image visible and maps the selection frame to the chosen crop window', () => {
  const styles = buildStageOverlayStyles(
    buildInitialCropModel({ width: 2000, height: 1000 }),
    { stageWidth: 300, stageHeight: 200 },
    { zoomPercent: 200, panXPercent: 25, panYPercent: 75 }
  );

  expect(styles.imageStyle).toContain('width: 300px');
  expect(styles.imageStyle).toContain('height: 150px');
  expect(styles.imageStyle).toContain('top: 25px');
  expect(styles.selectionStyle).toContain('width: 150px');
  expect(styles.selectionStyle).toContain('height: 75px');
  expect(styles.selectionStyle).toContain('left: 37.5px');
  expect(styles.selectionStyle).toContain('top: 81.25px');
  expect(styles.maskStyles).toHaveLength(4);
});
