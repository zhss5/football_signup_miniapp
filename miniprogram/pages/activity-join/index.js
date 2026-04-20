const { joinActivity } = require('../../services/registration-service');
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

  onPhoneInput(event) {
    this.setData({
      phone: event.detail.value
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

    if (this.data.requirePhone && !phone) {
      wx.showToast({ title: translate('errors.phoneRequired'), icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      await joinActivity({
        activityId: this.data.activityId,
        teamId: this.data.teamId,
        signupName,
        phone,
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
