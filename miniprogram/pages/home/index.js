const { ensureUserProfile } = require('../../services/user-service');
const { listActivities } = require('../../services/activity-service');
const { buildActivityCardVm } = require('../../utils/formatters');
const {
  getAppLocale,
  getMessages,
  makeTranslator,
  setPageNavigationTitle
} = require('../../utils/i18n');

Page({
  data: {
    items: [],
    loading: false,
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
    await ensureUserProfile();
    const { items } = await listActivities({ scope: 'home', limit: 20 });
    this.setData({
      items: items.map(item => buildActivityCardVm(item, undefined, translate)),
      loading: false
    });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/activity-create/index' });
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/activity-detail/index?activityId=${event.detail.id}` });
  }
});
