const { createActivity } = require('../../services/activity-service');
const { MAX_ACTIVITY_IMAGES, MAX_TEAMS } = require('../../utils/constants');
const {
  buildActivityPayload,
  createDefaultActivityForm,
  summarizeTeamSlots
} = require('../../utils/activity-draft');
const { validateActivityDraft } = require('../../utils/validators');

function getImagePath(result) {
  if (Array.isArray(result.tempFiles) && result.tempFiles[0]) {
    return result.tempFiles[0].tempFilePath || result.tempFiles[0].path || '';
  }

  if (Array.isArray(result.tempFilePaths) && result.tempFilePaths[0]) {
    return result.tempFilePaths[0];
  }

  return '';
}

function openCoverCropper(imagePath) {
  return new Promise((resolve, reject) => {
    wx.navigateTo({
      url: `/pages/activity-cover-crop/index?imagePath=${encodeURIComponent(imagePath)}`,
      events: {
        coverCropped: resolve,
        coverCropCancelled: () => resolve(null)
      },
      success(result) {
        if (result.eventChannel && typeof result.eventChannel.emit === 'function') {
          result.eventChannel.emit('coverCropSource', { imagePath });
        }
      },
      fail: reject
    });
  });
}

Page({
  data: {
    form: createDefaultActivityForm(),
    submitting: false,
    maxTeams: MAX_TEAMS,
    maxActivityImages: MAX_ACTIVITY_IMAGES,
    namedTeamSlots: 12,
    benchSlots: 0,
    overCapacity: false
  },

  onLoad() {
    this.syncDerivedState(this.data.form);
  },

  syncDerivedState(form) {
    const { namedTeamSlots, benchSlots, overCapacity } = summarizeTeamSlots(form);
    this.setData({
      form,
      namedTeamSlots,
      benchSlots,
      overCapacity
    });
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const form = {
      ...this.data.form,
      [field]: field === 'signupLimitTotal' ? Number(value) || 0 : value
    };

    this.syncDerivedState(form);
  },

  onPickerChange(event) {
    const field = event.currentTarget.dataset.field;
    const form = {
      ...this.data.form,
      [field]: event.detail.value
    };

    if (field === 'activityDate' && !this.data.form.signupDeadlineDate) {
      form.signupDeadlineDate = event.detail.value;
    }

    this.syncDerivedState(form);
  },

  onRequirePhoneChange(event) {
    const form = {
      ...this.data.form,
      requirePhone: event.detail.value
    };

    this.syncDerivedState(form);
  },

  onTeamsChange(event) {
    const form = {
      ...this.data.form,
      teams: event.detail.teams
    };

    this.syncDerivedState(form);
  },

  async onChooseLocation() {
    try {
      const result = await new Promise((resolve, reject) => {
        wx.chooseLocation({
          success: resolve,
          fail: reject
        });
      });

      const form = {
        ...this.data.form,
        addressText: result.address || result.name || '',
        addressName: result.name || result.address || '',
        location: {
          latitude: result.latitude,
          longitude: result.longitude
        }
      };

      this.syncDerivedState(form);
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }

      wx.showToast({ title: 'Unable to choose location', icon: 'none' });
    }
  },

  async onChooseActivityImage() {
    try {
      const result = await new Promise((resolve, reject) => {
        if (typeof wx.chooseMedia === 'function') {
          wx.chooseMedia({
            count: MAX_ACTIVITY_IMAGES,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          });
          return;
        }

        wx.chooseImage({
          count: MAX_ACTIVITY_IMAGES,
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        });
      });

      const imagePath = getImagePath(result);
      if (!imagePath) {
        return;
      }

      const cropResult = await openCoverCropper(imagePath);
      if (!cropResult || !cropResult.tempFilePath) {
        return;
      }

      const form = {
        ...this.data.form,
        coverImage: cropResult.tempFilePath,
        imageList: cropResult.imageList || [cropResult.tempFilePath]
      };

      this.syncDerivedState(form);
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }

      wx.showToast({ title: 'Unable to choose image', icon: 'none' });
    }
  },

  onRemoveActivityImage() {
    const form = {
      ...this.data.form,
      coverImage: '',
      imageList: []
    };

    this.syncDerivedState(form);
  },

  async onSubmit() {
    try {
      const payload = buildActivityPayload(this.data.form);
      validateActivityDraft(payload);
      this.setData({ submitting: true });
      const { activityId } = await createActivity(payload);
      wx.redirectTo({ url: `/pages/activity-detail/index?activityId=${activityId}` });
      this.syncDerivedState(createDefaultActivityForm());
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
