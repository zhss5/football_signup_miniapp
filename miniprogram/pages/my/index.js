const {
  cancelActivity,
  deleteActivity,
  listActivities
} = require('../../services/activity-service');
const { ensureUserProfile } = require('../../services/user-service');
const { buildActivityCardVm } = require('../../utils/formatters');
const {
  buildLanguageOptions,
  getAppLocale,
  getMessages,
  makeTranslator,
  setPageNavigationTitle,
  translateErrorMessage
} = require('../../utils/i18n');
const { formatRoles } = require('../../utils/roles');

Page({
  data: {
    locale: '',
    i18n: {},
    filterLabel: '',
    languageOptions: [],
    activeTab: 'created',
    tabs: [],
    createdFilter: 'all',
    createdFilters: [],
    createdItemsAll: [],
    createdItems: [],
    joinedItems: [],
    userOpenId: '',
    userRoleText: ''
  },

  applyI18n() {
    const locale = getAppLocale();
    const i18n = getMessages(locale);
    setPageNavigationTitle('nav.myActivities', locale);
    this.setData({
      locale,
      i18n,
      filterLabel: i18n.my.filterLabel,
      languageOptions: buildLanguageOptions(locale),
      tabs: [
        { key: 'created', label: i18n.my.tabs.created },
        { key: 'joined', label: i18n.my.tabs.joined }
      ],
      createdFilters: [
        { key: 'all', label: i18n.my.filters.all },
        { key: 'published', label: i18n.my.filters.published },
        { key: 'cancelled', label: i18n.my.filters.cancelled },
        { key: 'deleted', label: i18n.my.filters.deleted }
      ]
    });
    return makeTranslator(locale);
  },

  async onShow() {
    const translate = this.applyI18n();
    const profilePromise = this.refreshUserProfile();
    const [created, joined] = await Promise.all([
      listActivities({ scope: 'created', limit: 20 }),
      listActivities({ scope: 'joined', limit: 20 })
    ]);

    const createdItemsAll = created.items.map(item => buildActivityCardVm(item, undefined, translate));

    this.setData({
      createdItemsAll,
      joinedItems: joined.items.map(item => buildActivityCardVm(item, undefined, translate))
    });
    this.applyCreatedFilter(this.data.createdFilter, createdItemsAll);
    await profilePromise;
  },

  async refreshUserProfile() {
    try {
      const { user } = await ensureUserProfile();
      this.setData({
        userOpenId: user && user._id ? user._id : '',
        userRoleText: formatRoles(user)
      });
    } catch (error) {
      this.setData({
        userOpenId: '',
        userRoleText: ''
      });
    }
  },

  onCopyUserId() {
    if (!this.data.userOpenId) {
      return;
    }

    wx.setClipboardData({
      data: this.data.userOpenId,
      success: () => {
        wx.showToast({
          title: this.data.i18n.my.copyUserIdSuccess,
          icon: 'none'
        });
      }
    });
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

  onLanguageChange(event) {
    const locale = event.currentTarget.dataset.locale;
    getApp().setLocale(locale);
    this.onShow();
  },

  async onCancelActivity(event) {
    const activityId = event.currentTarget.dataset.activityId;
    const translate = makeTranslator(this.data.locale);
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: translate('modal.cancelActivity.title'),
        content: translate('modal.cancelActivity.content'),
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
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  async onDeleteActivity(event) {
    const activityId = event.currentTarget.dataset.activityId;
    const translate = makeTranslator(this.data.locale);
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: translate('modal.deleteActivity.title'),
        content: translate('modal.deleteActivity.content'),
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
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  }
});
