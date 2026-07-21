const {
  joinActivity,
  updateMyRegistrationProfile
} = require('../../services/registration-service');
const { getActivityDetail } = require('../../services/activity-service');
const { uploadFile } = require('../../services/cloud');
const {
  recordActivityNotificationSubscription,
  requestActivityNotificationSubscriptionConsent
} = require('../../services/notification-service');
const { ensureUserProfile } = require('../../services/user-service');
const {
  MAX_PREFERRED_POSITIONS,
  POSITION_VALUES,
  buildPositionOptions,
  normalizePreferredPositions
} = require('../../utils/positions');
const { normalizeSignupName } = require('../../utils/signup-name');
const {
  getAppLocale,
  getMessages,
  makeTranslator,
  setPageNavigationTitle,
  translateErrorMessage
} = require('../../utils/i18n');

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

function applyPageI18n(page, teamName, isEditMode = false) {
  const locale = getAppLocale();
  const i18n = getMessages(locale);
  const translate = makeTranslator(locale);
  setPageNavigationTitle(
    isEditMode ? 'nav.editRegistrationProfile' : teamName ? 'nav.joinTeam' : 'nav.joinActivity',
    locale,
    { teamName }
  );
  page.setData({
    locale,
    i18n,
    joinTitleText: translate('activityJoin.title', { teamName }),
    formTitleText: isEditMode
      ? translate('activityJoin.editTitle')
      : translate('activityJoin.title', { teamName }),
    formHintText: isEditMode
      ? translate('activityJoin.editHint')
      : translate('activityJoin.hint'),
    confirmButtonText: isEditMode
      ? translate('activityJoin.saveChanges')
      : translate('activityJoin.confirm')
  });
  return translate;
}

function buildAvatarCloudPath() {
  const suffix = Math.random().toString(36).slice(2, 10) || 'avatar';
  return `user-avatars/${Date.now()}-${suffix}.jpg`;
}

function normalizeProfileSource(value) {
  return value === 'wechat' ? 'wechat' : 'manual';
}

async function prefillUserProfile(page) {
  try {
    const { user = {} } = await ensureUserProfile();
    const update = {};
    const preferredName = String(user.preferredName || '').trim();
    const avatarUrl = String(user.avatarUrl || '').trim();
    const preferredPositions = normalizePreferredPositions(user.preferredPositions);

    if (!page.data.nameEdited && !page.data.signupName && preferredName) {
      update.signupName = preferredName;
    }

    if (!page.data.avatarEdited && !page.data.avatarUrl && avatarUrl) {
      update.avatarUrl = avatarUrl;
      update.avatarTempFilePath = '';
      update.profileSource = normalizeProfileSource(user.profileSource);
    }

    if (
      !page.data.positionsEdited &&
      normalizePreferredPositions(page.data.preferredPositions).length === 0 &&
      preferredPositions.length > 0
    ) {
      update.preferredPositions = preferredPositions;
      update.positionOptions = buildPositionOptions(preferredPositions);
    }

    if (Object.keys(update).length > 0) {
      page.setData(update);
    }
  } catch (error) {
    // Signup still works if the saved profile cannot be loaded.
  }
}

async function prefillRegistrationProfile(page, activityId) {
  const detail = await getActivityDetail(activityId);
  const registration = detail && detail.myRegistration;

  if (!registration) {
    throw new Error('Registration not found');
  }
  if (registration.status !== 'joined') {
    throw new Error('Only joined registrations can be edited');
  }
  if (registration.proxyRegistration === true) {
    throw new Error('Proxy registrations cannot be edited');
  }

  const preferredPositions = normalizePreferredPositions(registration.preferredPositions);
  page.setData({
    teamId: registration.teamId || '',
    signupName: String(registration.signupName || '').trim(),
    avatarUrl: String(registration.avatarUrl || '').trim(),
    avatarTempFilePath: '',
    profileSource: normalizeProfileSource(registration.profileSource),
    preferredPositions,
    positionOptions: buildPositionOptions(preferredPositions)
  });
}

Page({
  data: {
    activityId: '',
    teamId: '',
    teamName: '',
    mode: 'join',
    isEditMode: false,
    locale: '',
    i18n: {},
    joinTitleText: '',
    formTitleText: '',
    formHintText: '',
    confirmButtonText: '',
    signupName: '',
    nameEdited: false,
    avatarUrl: '',
    avatarTempFilePath: '',
    avatarEdited: false,
    profileSource: 'manual',
    preferredPositions: [],
    positionOptions: buildPositionOptions([]),
    positionsEdited: false,
    submitting: false
  },

  async onLoad(query) {
    const isEditMode = query.mode === 'edit';
    const teamName = decodeURIComponent(query.teamName || '');

    this.openerEventChannel =
      typeof wx.getOpenerEventChannel === 'function' ? wx.getOpenerEventChannel() : null;

    this.setData({
      activityId: query.activityId || '',
      teamId: query.teamId || '',
      teamName,
      mode: isEditMode ? 'edit' : 'join',
      isEditMode
    });

    applyPageI18n(this, teamName, isEditMode);
    if (isEditMode) {
      await prefillRegistrationProfile(this, query.activityId || '');
      return;
    }

    await prefillUserProfile(this);
  },

  onNameInput(event) {
    this.setData({
      signupName: event.detail.value,
      nameEdited: true
    });
  },

  onChooseAvatar(event) {
    const avatarUrl = event && event.detail ? event.detail.avatarUrl : '';

    if (!avatarUrl) {
      return;
    }

    this.setData({
      avatarUrl,
      avatarTempFilePath: avatarUrl,
      avatarEdited: true,
      profileSource: 'wechat'
    });
  },

  onClearAvatar() {
    this.setData({
      avatarUrl: '',
      avatarTempFilePath: '',
      avatarEdited: true,
      profileSource: 'manual'
    });
  },

  onPositionTap(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const value = String(event.currentTarget.dataset.value || '').trim();

    if (!POSITION_VALUES.includes(value)) {
      return;
    }

    const current = normalizePreferredPositions(this.data.preferredPositions);
    const next = current.includes(value)
      ? current.filter(item => item !== value)
      : current.length < MAX_PREFERRED_POSITIONS
        ? current.concat(value)
        : current;

    if (!current.includes(value) && current.length >= MAX_PREFERRED_POSITIONS) {
      wx.showToast({
        title: translate('activityJoin.preferredPositionsLimit'),
        icon: 'none'
      });
      return;
    }

    this.setData({
      preferredPositions: next,
      positionOptions: buildPositionOptions(next),
      positionsEdited: true
    });
  },

  async prefillUserProfile() {
    await prefillUserProfile(this);
  },

  async onSubmit() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const signupName = normalizeSignupName(this.data.signupName);

    if (!signupName) {
      wx.showToast({ title: translate('errors.signupNameRequired'), icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const subscriptionPromise = this.data.isEditMode
      ? Promise.resolve(null)
      : requestActivityNotificationSubscriptionConsent().catch(() => null);

    try {
      let avatarUrl = this.data.avatarUrl || '';

      if (this.data.avatarTempFilePath) {
        avatarUrl = await uploadFile(this.data.avatarTempFilePath, buildAvatarCloudPath());
      }

      const profilePayload = {
        activityId: this.data.activityId,
        signupName,
        avatarUrl,
        profileSource: avatarUrl && this.data.profileSource === 'wechat' ? 'wechat' : 'manual',
        preferredPositions: normalizePreferredPositions(this.data.preferredPositions)
      };

      if (this.data.isEditMode) {
        await updateMyRegistrationProfile(profilePayload);
      } else {
        await joinActivity({
          ...profilePayload,
          teamId: this.data.teamId,
          source: 'share'
        });
      }

      markActivityDetailForRefresh(this.data.activityId);
      const subscription = this.data.isEditMode ? null : await subscriptionPromise;
      if (subscription) {
        await recordActivityNotificationSubscription(this.data.activityId, subscription).catch(
          () => null
        );
      }

      if (
        !this.data.isEditMode &&
        this.openerEventChannel &&
        typeof this.openerEventChannel.emit === 'function'
      ) {
        this.openerEventChannel.emit('signupSuccess');
      }

      wx.showToast({
        title: translate(
          this.data.isEditMode ? 'activityJoin.updateSuccess' : 'activityJoin.success'
        ),
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        });
      }, 600);
    } catch (error) {
      wx.showToast({
        title: translateErrorMessage(error, translate),
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
