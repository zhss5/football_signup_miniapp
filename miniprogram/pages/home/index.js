const { ensureUserProfile } = require('../../services/user-service');
const { listActivities } = require('../../services/activity-service');
const { buildActivityCardVm } = require('../../utils/formatters');

Page({
  data: {
    items: [],
    loading: false
  },

  async onShow() {
    this.setData({ loading: true });
    await ensureUserProfile();
    const { items } = await listActivities({ scope: 'home', limit: 20 });
    this.setData({
      items: items.map(buildActivityCardVm),
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
