const { joinActivity, resolvePhoneNumber } = require('../../services/registration-service');
const { uploadFile } = require('../../services/cloud');
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

function applyPageI18n(page, teamName) {
  const locale = getAppLocale();
  const i18n = getMessages(locale);
  setPageNavigationTitle(teamName ? 'nav.joinTeam' : 'nav.joinActivity', locale, { teamName });
  page.setData({
    locale,
    i18n,
    joinTitleText: makeTranslator(locale)('activityJoin.title', { teamName })
  });
  return makeTranslator(locale);
}

function normalizePhoneSource(phone, authorizedPhone) {
  return phone && authorizedPhone && phone === authorizedPhone ? 'wechat' : 'manual';
}

function buildAvatarCloudPath() {
  const suffix = Math.random().toString(36).slice(2, 10) || 'avatar';
  return `user-avatars/${Date.now()}-${suffix}.jpg`;
}

Page({
  data: {
    activityId: '',
    teamId: '',
    teamName: '',
    requirePhone: false,
    locale: '',
    i18n: {},
    joinTitleText: '',
    signupName: '',
    phone: '',
    authorizedPhone: '',
    phoneSource: 'manual',
    avatarUrl: '',
    avatarTempFilePath: '',
    profileSource: 'manual',
    phoneAuthorizing: false,
    submitting: false
  },

  onLoad(query) {
    const teamName = decodeURIComponent(query.teamName || '');

    this.openerEventChannel =
      typeof wx.getOpenerEventChannel === 'function' ? wx.getOpenerEventChannel() : null;

    this.setData({
      activityId: query.activityId || '',
      teamId: query.teamId || '',
      teamName,
      requirePhone: query.requirePhone === '1'
    });

    applyPageI18n(this, teamName);
  },

  onNameInput(event) {
    this.setData({
      signupName: event.detail.value
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
      profileSource: 'wechat'
    });
  },

  async onGetPhoneNumber(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const detail = (event && event.detail) || {};
    const errMsg = detail.errMsg || '';

    if (errMsg && !errMsg.includes(':ok')) {
      wx.showToast({ title: translate('activityJoin.phoneAuthSkipped'), icon: 'none' });
      return;
    }

    if (!detail.code) {
      wx.showToast({ title: translate('activityJoin.phoneAuthFailed'), icon: 'none' });
      return;
    }

    this.setData({ phoneAuthorizing: true });

    try {
      const result = await resolvePhoneNumber(detail.code);
      const phone = String((result && result.phoneNumber) || '').trim();

      if (!phone) {
        throw new Error('Phone authorization failed');
      }

      this.setData({
        phone,
        authorizedPhone: phone,
        phoneSource: 'wechat'
      });
    } catch (error) {
      wx.showToast({ title: translate('activityJoin.phoneAuthFailed'), icon: 'none' });
    } finally {
      this.setData({ phoneAuthorizing: false });
    }
  },

  onPhoneInput(event) {
    const phone = event.detail.value;

    this.setData({
      phone,
      phoneSource: normalizePhoneSource(phone, this.data.authorizedPhone)
    });
  },

  async onSubmit() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const signupName = this.data.signupName.trim();
    const phone = this.data.phone.trim();

    if (!signupName) {
      wx.showToast({ title: translate('errors.signupNameRequired'), icon: 'none' });
      return;
    }

    if (!phone) {
      wx.showToast({ title: translate('errors.phoneRequired'), icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      let avatarUrl = this.data.avatarUrl || '';

      if (this.data.avatarTempFilePath) {
        avatarUrl = await uploadFile(this.data.avatarTempFilePath, buildAvatarCloudPath());
      }

      await joinActivity({
        activityId: this.data.activityId,
        teamId: this.data.teamId,
        signupName,
        phone,
        phoneSource: normalizePhoneSource(phone, this.data.authorizedPhone),
        avatarUrl,
        profileSource: avatarUrl && this.data.profileSource === 'wechat' ? 'wechat' : 'manual',
        source: 'share'
      });

      markActivityDetailForRefresh(this.data.activityId);

      if (this.openerEventChannel && typeof this.openerEventChannel.emit === 'function') {
        this.openerEventChannel.emit('signupSuccess');
      }

      wx.showToast({
        title: translate('activityJoin.success'),
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
