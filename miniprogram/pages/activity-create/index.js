const {
  createActivity,
  getActivityDetail,
  updateActivity
} = require('../../services/activity-service');
const { uploadFile } = require('../../services/cloud');
const { ensureUserProfile } = require('../../services/user-service');
const { MAX_ACTIVITY_IMAGES, MAX_DETAIL_IMAGES, MAX_TEAMS } = require('../../utils/constants');
const {
  buildActivityEditForm,
  buildActivityPayload,
  createDefaultActivityForm,
  getDefaultRegistrationNoticeThreshold,
  normalizeNotificationHint,
  summarizeTeamSlots
} = require('../../utils/activity-draft');
const {
  recordActivityNotificationSubscription,
  requestManagerRegistrationNotificationSubscriptionConsent
} = require('../../services/notification-service');
const { validateActivityDraft } = require('../../utils/validators');
const { TEAM_COLOR_OPTIONS } = require('../../utils/team-colors');
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

function getImagePaths(result) {
  if (Array.isArray(result.tempFiles)) {
    return result.tempFiles
      .map(file => file.tempFilePath || file.path || '')
      .filter(Boolean);
  }

  if (Array.isArray(result.tempFilePaths)) {
    return result.tempFilePaths.filter(Boolean);
  }

  return [];
}

function sumTeamCapacity(teams = []) {
  return teams.reduce((sum, team) => sum + (Number(team.maxMembers) || 0), 0);
}

function adjustSignupLimitForTeamChange(form, nextTeams) {
  const currentTotal = Number(form.signupLimitTotal) || 0;
  const currentTeamSlots = sumTeamCapacity(form.teams);
  const nextTeamSlots = sumTeamCapacity(nextTeams);
  const adjustedTotal = currentTotal + nextTeamSlots - currentTeamSlots;

  return Math.max(nextTeamSlots, adjustedTotal);
}

function adjustRegistrationNoticeThresholdForTotalChange(form, nextTotal) {
  const total = Number(nextTotal) || 0;
  const currentTotal = Number(form.signupLimitTotal) || 0;
  const currentThreshold = Number(form.registrationNoticeThreshold) || 0;
  const currentDefault = getDefaultRegistrationNoticeThreshold(currentTotal);

  if (!currentThreshold || currentThreshold > total || currentThreshold === currentDefault) {
    return getDefaultRegistrationNoticeThreshold(total);
  }

  return currentThreshold;
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

function cloneTeams(teams = []) {
  return teams.map(team => ({ ...team }));
}

function buildEditTeamSafetyError(form, originalTeams, translate) {
  if (!Array.isArray(originalTeams) || originalTeams.length === 0) {
    return null;
  }

  const currentTeamsById = new Map(
    (Array.isArray(form.teams) ? form.teams : [])
      .filter(team => team && team._id)
      .map(team => [team._id, team])
  );

  for (let index = 0; index < originalTeams.length; index += 1) {
    const originalTeam = originalTeams[index];
    const joinedCount = Number(originalTeam.joinedCount) || 0;

    if (!originalTeam._id || joinedCount <= 0) {
      continue;
    }

    if (!currentTeamsById.has(originalTeam._id)) {
      return new Error(translate('errors.joinedTeamCannotBeRemoved'));
    }
  }

  for (let index = 0; index < originalTeams.length; index += 1) {
    const originalTeam = originalTeams[index];
    const joinedCount = Number(originalTeam.joinedCount) || 0;
    const currentTeam = originalTeam._id ? currentTeamsById.get(originalTeam._id) : null;

    if (currentTeam && Number(currentTeam.maxMembers) < joinedCount) {
      return new Error(translate('errors.teamCapacityBelowJoined'));
    }
  }

  return null;
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

function buildShareImageCloudPath(filePath) {
  const extension = getCoverFileExtension(filePath);
  const suffix = Math.random().toString(36).slice(2, 10);

  return `activity-share-images/${Date.now()}-${suffix}${extension}`;
}

function buildDetailImageCloudPath(filePath) {
  const extension = getCoverFileExtension(filePath);
  const suffix = Math.random().toString(36).slice(2, 10);

  return `activity-detail-images/${Date.now()}-${suffix}${extension}`;
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://');
}

async function uploadActivityCover(payload) {
  const coverImage =
    payload.coverImage || (Array.isArray(payload.imageList) ? payload.imageList[0] : '');
  const coverThumbImage = payload.coverThumbImage || '';
  const shareImage = payload.shareImage || '';
  const detailImages = Array.isArray(payload.detailImages)
    ? payload.detailImages.filter(Boolean).slice(0, MAX_DETAIL_IMAGES)
    : [];
  const uploadedDetailImages = await Promise.all(
    detailImages.map(image =>
      isCloudFileId(image) ? image : uploadFile(image, buildDetailImageCloudPath(image))
    )
  );

  if (!coverImage) {
    return {
      ...payload,
      shareImage: '',
      detailImages: uploadedDetailImages
    };
  }

  const fileId = isCloudFileId(coverImage)
    ? coverImage
    : await uploadFile(coverImage, buildCoverCloudPath(coverImage));
  const thumbFileId = coverThumbImage && !isCloudFileId(coverThumbImage)
    ? await uploadFile(coverThumbImage, buildCoverThumbCloudPath(coverThumbImage))
    : coverThumbImage;
  const shareFileId = shareImage && !isCloudFileId(shareImage)
    ? await uploadFile(shareImage, buildShareImageCloudPath(shareImage))
    : shareImage;

  return {
    ...payload,
    coverImage: fileId,
    coverThumbImage: thumbFileId || '',
    shareImage: shareFileId || '',
    imageList: [fileId],
    detailImages: uploadedDetailImages
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
    maxDetailImages: MAX_DETAIL_IMAGES,
    namedTeamSlots: 12,
    benchSlots: 0,
    overCapacity: false,
    validationErrors: {},
    namedTeamsSlotsText: '',
    benchSlotsText: '',
    imageHintText: '',
    detailImageHintText: '',
    selectedPinText: '',
    authorizationChecked: false,
    canCreateActivity: false,
    canEditActivity: false,
    canSubmitActivity: false,
    isEditMode: false,
    editActivityId: '',
    editOriginalTeams: [],
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
    const defaultTeamNamePrefix = i18n.teamEditor.teamNamePrefix || '';
    const defaultTeamName = defaultTeamNamePrefix
      ? `${defaultTeamNamePrefix}1`
      : translate('teamEditor.whiteTeam');
    const defaultTeams = [
      { teamName: defaultTeamName, maxMembers: 12 }
    ];
    const form = resetForm ? createDefaultActivityForm({ defaultTeams }) : this.data.form;

    setPageNavigationTitle(this.data.isEditMode ? 'nav.editActivity' : 'nav.createActivity', locale);
    this.setData({
      locale,
      i18n,
      imageHintText: translate('activityCreate.imageHint', { count: MAX_ACTIVITY_IMAGES }),
      detailImageHintText: translate('activityCreate.detailImageHint', { count: MAX_DETAIL_IMAGES }),
      teamEditorLabels: {
        addTeam: i18n.teamEditor.addTeam,
        remove: i18n.teamEditor.remove,
        upToTeams: translate('teamEditor.upToTeams', { count: MAX_TEAMS }),
        teamNamePrefix: i18n.teamEditor.teamNamePrefix,
        colorPaletteTitle: i18n.teamEditor.colorPaletteTitle,
        colorOptions: TEAM_COLOR_OPTIONS.map(option => translate(option.labelKey))
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

      const editForm = buildActivityEditForm(detail.activity, detail.teams);
      this.setData({
        editOriginalTeams: cloneTeams(editForm.teams)
      });
      this.syncDerivedState(editForm, translate);
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
    const value =
      field === 'notificationHint'
        ? normalizeNotificationHint(event.detail.value)
        : event.detail.value;
    const numericFields = new Set(['signupLimitTotal', 'registrationNoticeThreshold']);
    const form = {
      ...this.data.form,
      [field]: numericFields.has(field) ? Number(value) || 0 : value
    };

    if (field === 'addressText') {
      form.addressName = '';
      form.location = null;
    }

    if (field === 'signupLimitTotal') {
      form.registrationNoticeThreshold = adjustRegistrationNoticeThresholdForTotalChange(
        this.data.form,
        form.signupLimitTotal
      );
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

    if (field === 'notificationHint') {
      return value;
    }

    return undefined;
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

  onTeamsChange(event) {
    const teams = Array.isArray(event.detail.teams) ? event.detail.teams : [];
    const signupLimitTotal = adjustSignupLimitForTeamChange(this.data.form, teams);
    const form = {
      ...this.data.form,
      teams,
      signupLimitTotal,
      registrationNoticeThreshold: adjustRegistrationNoticeThresholdForTotalChange(
        this.data.form,
        signupLimitTotal
      )
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
        shareImage: cropResult.shareTempFilePath || '',
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

  async onChooseDetailImages() {
    const currentImages = Array.isArray(this.data.form.detailImages)
      ? this.data.form.detailImages.filter(Boolean)
      : [];
    const remaining = MAX_DETAIL_IMAGES - currentImages.length;

    if (remaining <= 0) {
      wx.showToast({
        title: makeTranslator(this.data.locale || getAppLocale())('errors.tooManyDetailImages'),
        icon: 'none'
      });
      return;
    }

    try {
      const result = await new Promise((resolve, reject) => {
        if (typeof wx.chooseMedia === 'function') {
          wx.chooseMedia({
            count: remaining,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          });
          return;
        }

        wx.chooseImage({
          count: remaining,
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        });
      });

      const selectedImages = getImagePaths(result);
      if (selectedImages.length === 0) {
        return;
      }

      const form = {
        ...this.data.form,
        detailImages: currentImages.concat(selectedImages).slice(0, MAX_DETAIL_IMAGES)
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

  onRemoveDetailImage(event) {
    const removeIndex = Number(event.currentTarget.dataset.index);
    const detailImages = Array.isArray(this.data.form.detailImages)
      ? this.data.form.detailImages.filter(Boolean)
      : [];

    const form = {
      ...this.data.form,
      detailImages: detailImages.filter((_, index) => index !== removeIndex)
    };

    this.syncDerivedState(form);
  },

  onRemoveActivityImage() {
    const form = {
      ...this.data.form,
      coverImage: '',
      coverThumbImage: '',
      shareImage: '',
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
      const editTeamSafetyError = this.data.isEditMode
        ? buildEditTeamSafetyError(payload, this.data.editOriginalTeams, translate)
        : null;

      if (editTeamSafetyError) {
        throw editTeamSafetyError;
      }

      this.setData({ submitting: true });
      const managerSubscription = this.data.isEditMode
        ? null
        : await requestManagerRegistrationNotificationSubscriptionConsent().catch(() => null);
      const uploadedPayload = await uploadActivityCover(payload);
      const { activityId } = this.data.isEditMode
        ? await updateActivity({
            ...uploadedPayload,
            activityId: this.data.editActivityId
          })
        : await createActivity(uploadedPayload);
      if (!this.data.isEditMode && managerSubscription) {
        await recordActivityNotificationSubscription(activityId, managerSubscription).catch(() => null);
      }
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
