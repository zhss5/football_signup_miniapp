const {
  COVER_OUTPUT_HEIGHT,
  COVER_OUTPUT_WIDTH,
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  buildCropRect,
  buildInitialCropModel,
  buildStageMetrics,
  buildStageOverlayStyles
} = require('../../utils/cover-crop');

Page({
  data: {
    ready: false,
    imagePath: '',
    loadError: '',
    stageImageStyle: '',
    selectionFrameStyle: '',
    maskStyles: [],
    cropModel: null,
    cropRect: null,
    canPanX: false,
    canPanY: false,
    minZoomPercent: MIN_ZOOM_PERCENT,
    maxZoomPercent: MAX_ZOOM_PERCENT,
    processing: false
  },

  onLoad(options = {}) {
    try {
      this.stageMetrics = buildStageMetrics(wx.getSystemInfoSync());
    } catch (error) {
      this.stageMetrics = buildStageMetrics();
    }

    const queryImagePath = options.imagePath ? decodeURIComponent(options.imagePath) : '';
    const openerEventChannel =
      typeof this.getOpenerEventChannel === 'function' ? this.getOpenerEventChannel() : null;

    if (openerEventChannel && typeof openerEventChannel.on === 'function') {
      this.openerEventChannel = openerEventChannel;
      this.openerEventChannel.on('coverCropSource', ({ imagePath } = {}) => {
        if (imagePath && !this.data.ready) {
          this.initializeCropModel(imagePath);
        }
      });
    }

    if (queryImagePath) {
      this.initializeCropModel(queryImagePath);
      return;
    }

    if (!this.openerEventChannel) {
      this.setData({
        loadError: 'Unable to load image source.'
      });
    }
  },

  onUnload() {
    if (!this.resultDelivered && this.openerEventChannel) {
      this.openerEventChannel.emit('coverCropCancelled');
    }
  },

  async initializeCropModel(imagePath) {
    try {
      const imageInfo = await new Promise((resolve, reject) => {
        wx.getImageInfo({
          src: imagePath,
          success: resolve,
          fail: reject
        });
      });

      this.applyCropModel(buildInitialCropModel(imageInfo), imagePath);
    } catch (error) {
      wx.showToast({ title: 'Unable to open image', icon: 'none' });
      this.setData({
        loadError: 'Unable to open image.'
      });
    }
  },

  applyCropModel(cropModel, imagePath = this.data.imagePath) {
    const cropRect = buildCropRect(cropModel);
    const overlay = buildStageOverlayStyles(cropModel, this.stageMetrics || buildStageMetrics());

    this.setData({
      ready: true,
      imagePath,
      loadError: '',
      cropModel,
      cropRect,
      stageImageStyle: overlay.imageStyle,
      selectionFrameStyle: overlay.selectionStyle,
      maskStyles: overlay.maskStyles,
      canPanX: cropRect.width < cropModel.imageWidth,
      canPanY: cropRect.height < cropModel.imageHeight
    });
  },

  updateCropModel(partial) {
    if (!this.data.cropModel) {
      return;
    }

    this.applyCropModel({
      ...this.data.cropModel,
      ...partial
    });
  },

  onZoomChange(event) {
    this.updateCropModel({
      zoomPercent: Number(event.detail.value) || MIN_ZOOM_PERCENT
    });
  },

  onPanXChange(event) {
    this.updateCropModel({
      panXPercent: Number(event.detail.value) || 0
    });
  },

  onPanYChange(event) {
    this.updateCropModel({
      panYPercent: Number(event.detail.value) || 0
    });
  },

  async onConfirm() {
    if (!this.data.ready || this.data.processing) {
      return;
    }

    try {
      this.setData({ processing: true });
      const tempFilePath = await this.exportCroppedImage();
      this.resultDelivered = true;
      if (this.openerEventChannel) {
        this.openerEventChannel.emit('coverCropped', {
          tempFilePath,
          imageList: [tempFilePath]
        });
      }
      wx.navigateBack();
    } catch (error) {
      wx.showToast({ title: 'Unable to crop image', icon: 'none' });
    } finally {
      this.setData({ processing: false });
    }
  },

  onCancel() {
    this.resultDelivered = true;
    if (this.openerEventChannel) {
      this.openerEventChannel.emit('coverCropCancelled');
    }
    wx.navigateBack();
  },

  exportCroppedImage() {
    const { cropRect, imagePath } = this.data;

    return new Promise((resolve, reject) => {
      const context = wx.createCanvasContext('coverCropCanvas', this);
      context.clearRect(0, 0, COVER_OUTPUT_WIDTH, COVER_OUTPUT_HEIGHT);
      context.drawImage(
        imagePath,
        cropRect.x,
        cropRect.y,
        cropRect.width,
        cropRect.height,
        0,
        0,
        COVER_OUTPUT_WIDTH,
        COVER_OUTPUT_HEIGHT
      );
      context.draw(false, () => {
        wx.canvasToTempFilePath(
          {
            canvasId: 'coverCropCanvas',
            destWidth: COVER_OUTPUT_WIDTH,
            destHeight: COVER_OUTPUT_HEIGHT,
            fileType: 'jpg',
            quality: 0.92,
            success: ({ tempFilePath }) => resolve(tempFilePath),
            fail: reject
          },
          this
        );
      });
    });
  }
});
