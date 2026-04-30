const {
  listActivities,
  resolveActivityCoverImages
} = require('../../services/activity-service');
const { ensureUserProfile } = require('../../services/user-service');
const { buildActivityCardVm } = require('../../utils/formatters');
const {
  getAppLocale,
  getMessages,
  makeTranslator,
  setPageNavigationTitle
} = require('../../utils/i18n');
const { canCreateActivity } = require('../../utils/roles');

Page({
  data: {
    items: [],
    loading: false,
    canCreateActivity: false,
    locale: '',
    i18n: {}
  },

  applyI18n() {
    const locale = getAppLocale();
    const i18n = getMessages(locale);
    setPageNavigationTitle('nav.home', locale);
    this.setData({ locale, i18n });
    return makeTranslator(locale);
  },

  async onShow() {
    const translate = this.applyI18n();
    this.setData({ loading: true });
    const permissionPromise = this.refreshViewerPermissions();

    try {
      const { items } = await listActivities({ scope: 'home', limit: 20 });
      const itemsWithDisplayCovers = await resolveActivityCoverImages(items);
      this.setData({
        items: itemsWithDisplayCovers.map(item => buildActivityCardVm(item, undefined, translate)),
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });

      if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
        wx.showToast({
          title: translate('toast.loadActivitiesFailed'),
          icon: 'none'
        });
      }
    }

    await permissionPromise;
  },

  async refreshViewerPermissions() {
    try {
      const { user } = await ensureUserProfile();
      this.setData({
        canCreateActivity: canCreateActivity(user)
      });
    } catch (error) {
      this.setData({
        canCreateActivity: false
      });
    }
  },

  goCreate() {
    if (!this.data.canCreateActivity) {
      wx.showToast({
        title: makeTranslator(this.data.locale || getAppLocale())('errors.createActivityNotAllowed'),
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({ url: '/pages/activity-create/index' });
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/activity-detail/index?activityId=${event.detail.id}` });
  }
});
