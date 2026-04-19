const {
  cancelActivity,
  deleteActivity,
  listActivities
} = require('../../services/activity-service');
const { buildActivityCardVm } = require('../../utils/formatters');

Page({
  data: {
    activeTab: 'created',
    tabs: [
      { key: 'created', label: 'Created' },
      { key: 'joined', label: 'Joined' }
    ],
    createdFilter: 'all',
    createdFilters: [
      { key: 'all', label: 'All' },
      { key: 'published', label: 'Active' },
      { key: 'cancelled', label: 'Cancelled' },
      { key: 'deleted', label: 'Deleted' }
    ],
    createdItemsAll: [],
    createdItems: [],
    joinedItems: []
  },

  async onShow() {
    const [created, joined] = await Promise.all([
      listActivities({ scope: 'created', limit: 20 }),
      listActivities({ scope: 'joined', limit: 20 })
    ]);

    const createdItemsAll = created.items.map(buildActivityCardVm);

    this.setData({
      createdItemsAll,
      joinedItems: joined.items.map(buildActivityCardVm)
    });
    this.applyCreatedFilter(this.data.createdFilter, createdItemsAll);
  },

  applyCreatedFilter(filterKey, items = this.data.createdItemsAll) {
    const createdItems =
      filterKey === 'all' ? items : items.filter(item => item.status === filterKey);

    this.setData({
      createdFilter: filterKey,
      createdItems
    });
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/activity-detail/index?activityId=${event.detail.id}` });
  },

  onTabChange(event) {
    const activeTab = event.currentTarget.dataset.tabKey;
    this.setData({ activeTab });
  },

  onCreatedFilterTap(event) {
    const filterKey = event.currentTarget.dataset.filterKey;
    this.applyCreatedFilter(filterKey);
  },

  async onCancelActivity(event) {
    const activityId = event.currentTarget.dataset.activityId;
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: 'Cancel Activity',
        content: 'This will stop new signups and mark the activity as cancelled.',
        success: result => resolve(Boolean(result.confirm))
      });
    });

    if (!confirmed) {
      return;
    }

    try {
      await cancelActivity(activityId);
      await this.onShow();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  async onDeleteActivity(event) {
    const activityId = event.currentTarget.dataset.activityId;
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: 'Delete Activity',
        content: 'Only empty activities can be deleted. Deleted activities stay in your history.',
        success: result => resolve(Boolean(result.confirm))
      });
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteActivity(activityId);
      await this.onShow();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  }
});
