const { createActivity } = require('../../services/activity-service');
const { MAX_ACTIVITY_IMAGES, MAX_TEAMS } = require('../../utils/constants');
const {
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
    teamEditorLabels: {}
  },

  onLoad() {
    this.applyI18n(true);
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

    setPageNavigationTitle('nav.createActivity', locale);
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
      imageList: []
    };

    this.syncDerivedState(form);
  },

  async onSubmit() {
    const translate = makeTranslator(this.data.locale || getAppLocale());

    try {
      const payload = buildActivityPayload(this.data.form);
      this.setData({ validationErrors: {} });
      validateActivityDraft(payload, translate);
      this.setData({ submitting: true });
      const { activityId } = await createActivity(payload);
      wx.redirectTo({
        url: `/pages/activity-detail/index?activityId=${activityId}&fromPublish=1`
      });
      this.applyI18n(true);
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
