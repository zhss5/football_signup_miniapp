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

const HOME_PAGE_SIZE = 20;

function getCreatedAtTime(item = {}) {
  const createdAt = Date.parse(item.createdAt || '');
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function compareCreatedDesc(left, right) {
  return getCreatedAtTime(right) - getCreatedAtTime(left);
}

function prepareVisibleHomeActivities(items = [], translate) {
  return items
    .map(item => buildActivityCardVm(item, undefined, translate))
    .filter(item => item.statusTone === 'joinable')
    .sort(compareCreatedDesc);
}

function getActivityKey(item = {}) {
  return item.id || item._id || '';
}

function mergeHomeActivities(existingItems = [], nextItems = []) {
  const byId = new Map();

  existingItems.concat(nextItems).forEach(item => {
    const key = getActivityKey(item);
    if (key) {
      byId.set(key, item);
    }
  });

  return Array.from(byId.values()).sort(compareCreatedDesc);
}

function resolveHasMore(result = {}, itemCount, limit) {
  if (typeof result.hasMore === 'boolean') {
    return result.hasMore;
  }

  return itemCount >= limit;
}

Page({
  data: {
    items: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    nextSkip: 0,
    emptyVisible: false,
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
    const loadToken = (this.homeLoadToken || 0) + 1;
    this.homeLoadToken = loadToken;
    this.setData({
      loading: true,
      loadingMore: false,
      hasMore: false,
      nextSkip: 0
    });
    const permissionPromise = this.refreshViewerPermissions();

    await this.loadHomeActivities(translate, loadToken, { append: false });
    await permissionPromise;
  },

  async loadHomeActivities(translate, loadToken, options = {}) {
    const append = Boolean(options.append);
    const skip = append ? Number(this.data.nextSkip || HOME_PAGE_SIZE) : 0;

    if (append && (this.data.loadingMore || !this.data.hasMore)) {
      return;
    }

    if (append) {
      this.setData({ loadingMore: true });
    }

    try {
      const result = await listActivities({
        scope: 'home',
        limit: HOME_PAGE_SIZE,
        skip
      });
      const items = Array.isArray(result.items) ? result.items : [];

      if (this.homeLoadToken !== loadToken) {
        return;
      }

      const visibleItems = prepareVisibleHomeActivities(items, translate);
      const nextItems = append
        ? mergeHomeActivities(this.data.items, visibleItems)
        : visibleItems;

      if (this.homeLoadToken !== loadToken) {
        return;
      }

      this.setData({
        items: nextItems,
        loading: false,
        loadingMore: false,
        hasMore: resolveHasMore(result, items.length, HOME_PAGE_SIZE),
        nextSkip: skip + HOME_PAGE_SIZE,
        emptyVisible: nextItems.length === 0
      });

      resolveActivityCoverImages(visibleItems, {
        includeShareImage: false
      })
        .then(itemsWithDisplayCovers => {
          if (this.homeLoadToken !== loadToken) {
            return;
          }

          const itemsWithCovers = append
            ? mergeHomeActivities(this.data.items, itemsWithDisplayCovers)
            : itemsWithDisplayCovers;

          this.setData({
            items: itemsWithCovers
          });
        })
        .catch(() => {
          // The list is already visible; failed cover resolution should not blank the page.
        });
    } catch (error) {
      this.setData({
        loading: false,
        loadingMore: false,
        emptyVisible: this.data.items.length === 0
      });

      if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
        wx.showToast({
          title: translate('toast.loadActivitiesFailed'),
          icon: 'none'
        });
      }
    }
  },

  async loadMore() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    await this.loadHomeActivities(translate, this.homeLoadToken || 0, { append: true });
  },

  async onReachBottom() {
    await this.loadMore();
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
