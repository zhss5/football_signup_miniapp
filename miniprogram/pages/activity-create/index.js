const {
  createActivity,
  getActivityDetail,
  updateActivity
} = require('../../services/activity-service');
const { uploadFile } = require('../../services/cloud');
const { ensureUserProfile } = require('../../services/user-service');
const { MAX_ACTIVITY_IMAGES, MAX_TEAMS } = require('../../utils/constants');
const {
  buildActivityEditForm,
  buildActivityPayload,
  createDefaultActivityForm,
  summarizeTeamSlots
} = require('../../utils/activity-draft');
const { validateActivityDraft } = require('../../utils/validators');
const {
  getAppLocale,
  getMessages,
  makeTranslator,
  setPageNavigationTitle,
  translateErrorMessage
} = require('../../utils/i18n');
const { canCreateActivity } = require('../../utils/roles');

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

function getValidationErrors(error) {
  if (
    error &&
    (error.field === 'addressText' ||
      error.message === 'Activity address is required' ||
      error.message === '活动地址不能为空')
  ) {
    return {
      addressText: error.message
    };
  }

  return {};
}

function getCoverFileExtension(filePath) {
  const cleanPath = String(filePath || '').split('?')[0];
  const match = cleanPath.match(/\.(jpe?g|png|webp)$/i);

  if (!match) {
    return '.jpg';
  }

  return `.${match[1].toLowerCase().replace('jpeg', 'jpg')}`;
}

function buildCoverCloudPath(filePath) {
  const extension = getCoverFileExtension(filePath);
  const suffix = Math.random().toString(36).slice(2, 10);

  return `activity-covers/${Date.now()}-${suffix}${extension}`;
}

function buildCoverThumbCloudPath(filePath) {
  const extension = getCoverFileExtension(filePath);
  const suffix = Math.random().toString(36).slice(2, 10);

  return `activity-cover-thumbs/${Date.now()}-${suffix}${extension}`;
}

async function uploadActivityCover(payload) {
  const coverImage =
    payload.coverImage || (Array.isArray(payload.imageList) ? payload.imageList[0] : '');
  const coverThumbImage = payload.coverThumbImage || '';

  if (!coverImage) {
    return payload;
  }

  if (/^(cloud|https?):\/\//.test(coverImage)) {
    return payload;
  }

  const fileId = await uploadFile(coverImage, buildCoverCloudPath(coverImage));
  const thumbFileId = coverThumbImage && !/^(cloud|https?):\/\//.test(coverThumbImage)
    ? await uploadFile(coverThumbImage, buildCoverThumbCloudPath(coverThumbImage))
    : coverThumbImage;

  return {
    ...payload,
    coverImage: fileId,
    coverThumbImage: thumbFileId || '',
    imageList: [fileId]
  };
}

function markActivityDetailForRefresh(activityId) {
  if (typeof getApp !== 'function') {
    return;
  }

  const app = getApp();
  if (!app.globalData) {
    app.globalData = {};
  }

  if (!app.globalData.activityDetailRefreshFlags) {
    app.globalData.activityDetailRefreshFlags = {};
  }

  app.globalData.activityDetailRefreshFlags[activityId] = true;
}

function returnToEditedActivityDetail(activityId) {
  markActivityDetailForRefresh(activityId);

  if (typeof wx.navigateBack === 'function') {
    wx.navigateBack({ delta: 1 });
    return;
  }

  wx.redirectTo({
    url: `/pages/activity-detail/index?activityId=${activityId}`
  });
}

Page({
  data: {
    form: createDefaultActivityForm(),
    locale: '',
    i18n: {},
    submitting: false,
    maxTeams: MAX_TEAMS,
    maxActivityImages: MAX_ACTIVITY_IMAGES,
    namedTeamSlots: 12,
    benchSlots: 0,
    overCapacity: false,
    validationErrors: {},
    namedTeamsSlotsText: '',
    benchSlotsText: '',
    imageHintText: '',
    selectedPinText: '',
    authorizationChecked: false,
    canCreateActivity: false,
    canEditActivity: false,
    canSubmitActivity: false,
    isEditMode: false,
    editActivityId: '',
    teamEditorLabels: {}
  },

  async onLoad(query = {}) {
    const isEditMode = query.mode === 'edit';
    this.setData({
      isEditMode,
      editActivityId: query.activityId || ''
    });

    const translate = this.applyI18n(!isEditMode);

    if (isEditMode) {
      await this.loadActivityForEdit(query.activityId, translate);
      return;
    }

    await this.refreshCreatePermission(translate);
  },

  applyI18n(resetForm = false) {
    const locale = getAppLocale();
    const i18n = getMessages(locale);
    const translate = makeTranslator(locale);
    const defaultTeams = [
      { teamName: translate('teamEditor.whiteTeam'), maxMembers: 6 },
      { teamName: translate('teamEditor.redTeam'), maxMembers: 6 }
    ];
    const form = resetForm ? createDefaultActivityForm({ defaultTeams }) : this.data.form;

    setPageNavigationTitle(this.data.isEditMode ? 'nav.editActivity' : 'nav.createActivity', locale);
    this.setData({
      locale,
      i18n,
      imageHintText: translate('activityCreate.imageHint', { count: MAX_ACTIVITY_IMAGES }),
      teamEditorLabels: {
        addTeam: i18n.teamEditor.addTeam,
        remove: i18n.teamEditor.remove,
        upToTeams: translate('teamEditor.upToTeams', { count: MAX_TEAMS }),
        teamNamePrefix: i18n.teamEditor.teamNamePrefix
      }
    });
    this.syncDerivedState(form, translate);
    return translate;
  },

  async refreshCreatePermission(translate = makeTranslator(this.data.locale || getAppLocale())) {
    try {
      const { user } = await ensureUserProfile();
      const allowed = canCreateActivity(user);
      this.setData({
        authorizationChecked: true,
        canCreateActivity: allowed,
        canSubmitActivity: allowed
      });
    } catch (error) {
      this.setData({
        authorizationChecked: true,
        canCreateActivity: false,
        canSubmitActivity: false
      });
      wx.showToast({
        title: translate('errors.createPermissionCheckFailed'),
        icon: 'none'
      });
    }
  },

  async loadActivityForEdit(activityId, translate = makeTranslator(this.data.locale || getAppLocale())) {
    try {
      const detail = await getActivityDetail(activityId);
      const allowed = Boolean(detail.viewer && detail.viewer.canEditActivity);

      this.setData({
        authorizationChecked: true,
        canEditActivity: allowed,
        canSubmitActivity: allowed
      });

      if (!allowed) {
        wx.showToast({
          title: translate('errors.editActivityNotAllowed'),
          icon: 'none'
        });
        return;
      }

      this.syncDerivedState(buildActivityEditForm(detail.activity, detail.teams), translate);
    } catch (error) {
      this.setData({
        authorizationChecked: true,
        canEditActivity: false,
        canSubmitActivity: false
      });
      wx.showToast({
        title: translateErrorMessage(error, translate),
        icon: 'none'
      });
    }
  },

  syncDerivedState(form, translate = makeTranslator(this.data.locale || getAppLocale())) {
    const { namedTeamSlots, benchSlots, overCapacity } = summarizeTeamSlots(form);
    this.setData({
      form,
      namedTeamSlots,
      benchSlots,
      overCapacity,
      namedTeamsSlotsText: translate('activityCreate.namedTeamsSlots', { count: namedTeamSlots }),
      benchSlotsText: translate('activityCreate.benchSlots', { count: benchSlots }),
      selectedPinText: form.addressName
        ? translate('activityCreate.selectedPin', { name: form.addressName })
        : ''
    });
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const form = {
      ...this.data.form,
      [field]: field === 'signupLimitTotal' ? Number(value) || 0 : value
    };

    if (field === 'addressText') {
      form.addressName = '';
      form.location = null;
    }

    this.syncDerivedState(form);

    if (this.data.validationErrors[field]) {
      this.setData({
        validationErrors: {
          ...this.data.validationErrors,
          [field]: ''
        }
      });
    }
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
      if (this.data.validationErrors.addressText) {
        this.setData({
          validationErrors: {
            ...this.data.validationErrors,
            addressText: ''
          }
        });
      }
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }

      wx.showToast({
        title: makeTranslator(this.data.locale || getAppLocale())('toast.chooseLocationFailed'),
        icon: 'none'
      });
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
        coverThumbImage: cropResult.thumbTempFilePath || '',
        imageList: cropResult.imageList || [cropResult.tempFilePath]
      };

      this.syncDerivedState(form);
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }

      wx.showToast({
        title: makeTranslator(this.data.locale || getAppLocale())('toast.chooseImageFailed'),
        icon: 'none'
      });
    }
  },

  onRemoveActivityImage() {
    const form = {
      ...this.data.form,
      coverImage: '',
      coverThumbImage: '',
      imageList: []
    };

    this.syncDerivedState(form);
  },

  async onSubmit() {
    const translate = makeTranslator(this.data.locale || getAppLocale());

    const canSubmit = this.data.canSubmitActivity ||
      (!this.data.isEditMode && this.data.canCreateActivity);

    if (!canSubmit) {
      wx.showToast({
        title: translate(this.data.isEditMode
          ? 'errors.editActivityNotAllowed'
          : 'errors.createActivityNotAllowed'),
        icon: 'none'
      });
      return;
    }

    try {
      const payload = buildActivityPayload(this.data.form);
      this.setData({ validationErrors: {} });
      validateActivityDraft(payload, translate);
      this.setData({ submitting: true });
      const uploadedPayload = await uploadActivityCover(payload);
      const { activityId } = this.data.isEditMode
        ? await updateActivity({
            ...uploadedPayload,
            activityId: this.data.editActivityId
          })
        : await createActivity(uploadedPayload);
      if (this.data.isEditMode) {
        returnToEditedActivityDetail(activityId);
        return;
      }

      wx.redirectTo({
        url: `/pages/activity-detail/index?activityId=${activityId}&fromPublish=1`
      });
      if (!this.data.isEditMode) {
        this.applyI18n(true);
      }
    } catch (error) {
      this.setData({
        validationErrors: getValidationErrors(error)
      });
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
