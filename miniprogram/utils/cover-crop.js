const COVER_ASPECT_RATIO = 2;
const COVER_OUTPUT_WIDTH = 1200;
const COVER_OUTPUT_HEIGHT = 600;
const COVER_OUTPUT_QUALITY = 0.78;
const MIN_ZOOM_PERCENT = 100;
const MAX_ZOOM_PERCENT = 300;
const CROP_STAGE_HEIGHT_RPX = 720;
const CROP_STAGE_HORIZONTAL_PADDING_RPX = 48;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function formatPx(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? `${rounded}px` : `${rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}px`;
}

function rpxToPx(rpx, windowWidth) {
  return (Number(windowWidth) || 0) * (rpx / 750);
}

function buildBaseCropRect(imageWidth, imageHeight) {
  const imageRatio = imageWidth / imageHeight;

  if (imageRatio >= COVER_ASPECT_RATIO) {
    const cropHeight = imageHeight;
    const cropWidth = cropHeight * COVER_ASPECT_RATIO;

    return {
      x: Math.round((imageWidth - cropWidth) / 2),
      y: 0,
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };
  }

  const cropWidth = imageWidth;
  const cropHeight = cropWidth / COVER_ASPECT_RATIO;

  return {
    x: 0,
    y: Math.round((imageHeight - cropHeight) / 2),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight)
  };
}

function buildInitialCropModel({ width, height }) {
  return {
    imageWidth: Number(width) || COVER_OUTPUT_WIDTH,
    imageHeight: Number(height) || COVER_OUTPUT_HEIGHT,
    zoomPercent: MIN_ZOOM_PERCENT,
    panXPercent: 50,
    panYPercent: 50
  };
}

function buildCropRect(model, overrides = {}) {
  const state = {
    ...model,
    ...overrides
  };
  const baseRect = buildBaseCropRect(state.imageWidth, state.imageHeight);
  const zoom = clamp(Number(state.zoomPercent) || MIN_ZOOM_PERCENT, MIN_ZOOM_PERCENT, MAX_ZOOM_PERCENT) / 100;
  const cropWidth = Math.round(baseRect.width / zoom);
  const cropHeight = Math.round(baseRect.height / zoom);
  const maxX = Math.max(state.imageWidth - cropWidth, 0);
  const maxY = Math.max(state.imageHeight - cropHeight, 0);

  return {
    x: Math.round((clamp(Number(state.panXPercent) || 0, 0, 100) / 100) * maxX),
    y: Math.round((clamp(Number(state.panYPercent) || 0, 0, 100) / 100) * maxY),
    width: cropWidth,
    height: cropHeight
  };
}

function buildPreviewStyle(model, overrides = {}) {
  const state = {
    ...model,
    ...overrides
  };
  const rect = buildCropRect(state);
  const widthPercent = (state.imageWidth / rect.width) * 100;
  const heightPercent = (state.imageHeight / rect.height) * 100;
  const leftPercent = (-rect.x / rect.width) * 100;
  const topPercent = (-rect.y / rect.height) * 100;

  return [
    `width: ${formatPercent(widthPercent)}%`,
    `height: ${formatPercent(heightPercent)}%`,
    `left: ${formatPercent(leftPercent)}%`,
    `top: ${formatPercent(topPercent)}%`
  ].join('; ');
}

function buildAspectFitBox(imageWidth, imageHeight, stageWidth, stageHeight) {
  const safeWidth = Math.max(Number(stageWidth) || 0, 1);
  const safeHeight = Math.max(Number(stageHeight) || 0, 1);
  const safeImageWidth = Math.max(Number(imageWidth) || COVER_OUTPUT_WIDTH, 1);
  const safeImageHeight = Math.max(Number(imageHeight) || COVER_OUTPUT_HEIGHT, 1);
  const scale = Math.min(safeWidth / safeImageWidth, safeHeight / safeImageHeight);
  const width = safeImageWidth * scale;
  const height = safeImageHeight * scale;

  return {
    left: (safeWidth - width) / 2,
    top: (safeHeight - height) / 2,
    width,
    height
  };
}

function buildStageMetrics(viewport = {}) {
  const windowWidth = Number(viewport.windowWidth) || 375;

  return {
    stageWidth: Math.max(windowWidth - rpxToPx(CROP_STAGE_HORIZONTAL_PADDING_RPX, windowWidth), 1),
    stageHeight: Math.max(rpxToPx(CROP_STAGE_HEIGHT_RPX, windowWidth), 1)
  };
}

function buildStageOverlayStyles(model, stageMetrics, overrides = {}) {
  const state = {
    ...model,
    ...overrides
  };
  const rect = buildCropRect(state);
  const stage = buildAspectFitBox(
    state.imageWidth,
    state.imageHeight,
    stageMetrics.stageWidth,
    stageMetrics.stageHeight
  );
  const frameLeft = stage.left + (rect.x / state.imageWidth) * stage.width;
  const frameTop = stage.top + (rect.y / state.imageHeight) * stage.height;
  const frameWidth = (rect.width / state.imageWidth) * stage.width;
  const frameHeight = (rect.height / state.imageHeight) * stage.height;
  const frameRight = frameLeft + frameWidth;
  const frameBottom = frameTop + frameHeight;

  return {
    imageStyle: [
      `left: ${formatPx(stage.left)}`,
      `top: ${formatPx(stage.top)}`,
      `width: ${formatPx(stage.width)}`,
      `height: ${formatPx(stage.height)}`
    ].join('; '),
    selectionStyle: [
      `left: ${formatPx(frameLeft)}`,
      `top: ${formatPx(frameTop)}`,
      `width: ${formatPx(frameWidth)}`,
      `height: ${formatPx(frameHeight)}`
    ].join('; '),
    maskStyles: [
      `left: 0px; top: 0px; width: ${formatPx(stageMetrics.stageWidth)}; height: ${formatPx(frameTop)}`,
      `left: 0px; top: ${formatPx(frameBottom)}; width: ${formatPx(stageMetrics.stageWidth)}; height: ${formatPx(Math.max(stageMetrics.stageHeight - frameBottom, 0))}`,
      `left: 0px; top: ${formatPx(frameTop)}; width: ${formatPx(frameLeft)}; height: ${formatPx(frameHeight)}`,
      `left: ${formatPx(frameRight)}; top: ${formatPx(frameTop)}; width: ${formatPx(Math.max(stageMetrics.stageWidth - frameRight, 0))}; height: ${formatPx(frameHeight)}`
    ]
  };
}

module.exports = {
  COVER_ASPECT_RATIO,
  COVER_OUTPUT_HEIGHT,
  COVER_OUTPUT_QUALITY,
  COVER_OUTPUT_WIDTH,
  CROP_STAGE_HEIGHT_RPX,
  CROP_STAGE_HORIZONTAL_PADDING_RPX,
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  buildCropRect,
  buildInitialCropModel,
  buildPreviewStyle,
  buildStageMetrics,
  buildStageOverlayStyles
};
