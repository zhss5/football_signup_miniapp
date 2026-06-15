const {
  cancelActivity,
  deleteActivity,
  listActivities,
  resolveActivityCoverImages
} = require('../../services/activity-service');
const { notifyActivityParticipants } = require('../../services/notification-service');
const { ensureUserProfile } = require('../../services/user-service');
const { confirmWebAdminLogin } = require('../../services/web-admin-service');
const { buildActivityCardVm } = require('../../utils/formatters');
const {
  buildLanguageOptions,
  getAppLocale,
  getMessages,
  makeTranslator,
  setPageNavigationTitle,
  translateErrorMessage
} = require('../../utils/i18n');
const { canCreateActivity, formatRoles } = require('../../utils/roles');

const MY_PAGE_SIZE = 20;

function getActivityStartTime(item = {}) {
  const startAt = Date.parse(item.startAt || '');
  return Number.isFinite(startAt) ? startAt : 0;
}

function getActivityEndTime(item = {}) {
  const endAt = Date.parse(item.endAt || '');
  return Number.isFinite(endAt) ? endAt : 0;
}

function isActiveCreatedActivity(item = {}, now = Date.now()) {
  if (item.status !== 'published') {
    return false;
  }

  const endAt = getActivityEndTime(item);
  return !endAt || endAt >= now;
}

function matchesCreatedFilter(item, filterKey) {
  if (filterKey === 'all') {
    return true;
  }

  if (filterKey === 'published') {
    return isActiveCreatedActivity(item);
  }

  return item.status === filterKey;
}

function compareStartDesc(left, right) {
  return getActivityStartTime(right) - getActivityStartTime(left);
}

function isOverdueUnresolvedActivity(item = {}, now = Date.now()) {
  if (item.status !== 'published' || item.confirmStatus === 'confirmed') {
    return false;
  }

  const endAt = getActivityEndTime(item);
  return Boolean(endAt && endAt < now);
}

function getActivityKey(item = {}) {
  return item.id || item._id || '';
}

function mergeActivityItems(existingItems = [], nextItems = []) {
  const byId = new Map();

  existingItems.concat(nextItems).forEach(item => {
    const key = getActivityKey(item);
    if (key) {
      byId.set(key, item);
    }
  });

  return Array.from(byId.values()).sort(compareStartDesc);
}

function resolveHasMore(result = {}, itemCount, limit) {
  if (typeof result.hasMore === 'boolean') {
    return result.hasMore;
  }

  return itemCount >= limit;
}

function prepareMyActivityItems(items = [], translate, now = Date.now()) {
  return items
    .map(item => {
      const viewModel = buildActivityCardVm(item, undefined, translate);
      return {
        ...viewModel,
        overdueUnresolved: isOverdueUnresolvedActivity(viewModel, now)
      };
    })
    .sort(compareStartDesc);
}

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
    createdHasMore: false,
    joinedHasMore: false,
    createdLoadingMore: false,
    joinedLoadingMore: false,
    createdNextSkip: 0,
    joinedNextSkip: 0,
    userOpenId: '',
    userRoleText: '',
    canConfirmWebAdminLogin: false
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
    const loadToken = (this.myActivitiesLoadToken || 0) + 1;
    this.myActivitiesLoadToken = loadToken;
    this.setData({
      createdHasMore: false,
      joinedHasMore: false,
      createdLoadingMore: false,
      joinedLoadingMore: false,
      createdNextSkip: 0,
      joinedNextSkip: 0
    });
    const profilePromise = this.refreshUserProfile();
    await Promise.all([
      profilePromise,
      this.loadMyActivityList('created', translate, loadToken),
      this.loadMyActivityList('joined', translate, loadToken)
    ]);
  },

  async loadMyActivityList(scope, translate, loadToken, options = {}) {
    const append = Boolean(options.append);
    const skipKey = scope === 'created' ? 'createdNextSkip' : 'joinedNextSkip';
    const loadingKey = scope === 'created' ? 'createdLoadingMore' : 'joinedLoadingMore';
    const hasMoreKey = scope === 'created' ? 'createdHasMore' : 'joinedHasMore';
    const skip = append ? Number(this.data[skipKey] || MY_PAGE_SIZE) : 0;

    if (append && (this.data[loadingKey] || !this.data[hasMoreKey])) {
      return;
    }

    if (append) {
      this.setData({ [loadingKey]: true });
    }

    try {
      const result = await listActivities({
        scope,
        limit: MY_PAGE_SIZE,
        skip
      });

      if (this.myActivitiesLoadToken !== loadToken) {
        return;
      }

      const items = Array.isArray(result.items) ? result.items : [];
      this.applyMyActivityItems(scope, items, translate, { append });
      this.setData({
        [hasMoreKey]: resolveHasMore(result, items.length, MY_PAGE_SIZE),
        [skipKey]: skip + MY_PAGE_SIZE,
        [loadingKey]: false
      });
      this.resolveMyActivityCovers(scope, items, translate, loadToken, { append });
    } catch (error) {
      if (this.myActivitiesLoadToken !== loadToken) {
        return;
      }

      if (append) {
        this.setData({ [loadingKey]: false });
        return;
      }

      this.applyMyActivityItems(scope, [], translate, { append: false });
      this.setData({
        [hasMoreKey]: false,
        [skipKey]: 0,
        [loadingKey]: false
      });
    }
  },

  applyMyActivityItems(scope, items, translate, options = {}) {
    const preparedItems = prepareMyActivityItems(items, translate);

    if (scope === 'created') {
      const createdItemsAll = options.append
        ? mergeActivityItems(this.data.createdItemsAll, preparedItems)
        : preparedItems;

      this.setData({
        createdItemsAll
      });
      this.applyCreatedFilter(this.data.createdFilter, createdItemsAll);
      return;
    }

    const joinedItems = options.append
      ? mergeActivityItems(this.data.joinedItems, preparedItems)
      : preparedItems;

    this.setData({
      joinedItems
    });
  },

  async resolveMyActivityCovers(scope, items, translate, loadToken, options = {}) {
    try {
      const itemsWithCovers = await resolveActivityCoverImages(items, {
        includeShareImage: false
      });

      if (this.myActivitiesLoadToken !== loadToken) {
        return;
      }

      this.applyMyActivityItems(scope, itemsWithCovers, translate, options);
    } catch (error) {
      // Keep the already-rendered text list visible when cover resolution is slow or unavailable.
    }
  },

  async refreshUserProfile() {
    try {
      const { user } = await ensureUserProfile();
      this.setData({
        userOpenId: user && user._id ? user._id : '',
        userRoleText: formatRoles(user),
        canConfirmWebAdminLogin: canCreateActivity(user)
      });
    } catch (error) {
      this.setData({
        userOpenId: '',
        userRoleText: '',
        canConfirmWebAdminLogin: false
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

  scanWebAdminLoginPayload(translate) {
    const wxRuntime = typeof wx !== 'undefined' ? wx : null;
    if (!wxRuntime || typeof wxRuntime.scanCode !== 'function') {
      if (wxRuntime && typeof wxRuntime.showToast === 'function') {
        wxRuntime.showToast({
          title: translate('toast.webAdminLoginScanUnavailable'),
          icon: 'none'
        });
      }
      return Promise.resolve('');
    }

    return new Promise(resolve => {
      wxRuntime.scanCode({
        onlyFromCamera: false,
        success: result => resolve(String((result && result.result) || '').trim()),
        fail: () => resolve('')
      });
    });
  },

  confirmWebAdminLoginPrompt(translate) {
    return new Promise(resolve => {
      wx.showModal({
        title: translate('my.webAdminLoginConfirmTitle'),
        content: translate('my.webAdminLoginConfirmContent'),
        success: result => resolve(Boolean(result.confirm))
      });
    });
  },

  async onConfirmWebAdminLogin() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const qrPayload = await this.scanWebAdminLoginPayload(translate);

    if (!qrPayload) {
      wx.showToast({
        title: translate('toast.webAdminLoginInvalidQr'),
        icon: 'none'
      });
      return;
    }

    const confirmed = await this.confirmWebAdminLoginPrompt(translate);
    if (!confirmed) {
      return;
    }

    try {
      await confirmWebAdminLogin(qrPayload);
      wx.showToast({
        title: translate('toast.webAdminLoginConfirmed'),
        icon: 'success'
      });
    } catch (error) {
      wx.showToast({
        title: translateErrorMessage(error, translate),
        icon: 'none'
      });
    }
  },

  applyCreatedFilter(filterKey, items = this.data.createdItemsAll) {
    const createdItems = items.filter(item => matchesCreatedFilter(item, filterKey));

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

  async loadMoreMyActivities(eventOrScope) {
    const scope =
      typeof eventOrScope === 'string'
        ? eventOrScope
        : eventOrScope.currentTarget.dataset.scope;
    const translate = makeTranslator(this.data.locale || getAppLocale());
    await this.loadMyActivityList(scope || this.data.activeTab, translate, this.myActivitiesLoadToken || 0, {
      append: true
    });
  },

  async onReachBottom() {
    await this.loadMoreMyActivities(this.data.activeTab);
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

  async onConfirmActivityProceeding(event) {
    const activityId = event.currentTarget.dataset.activityId;
    const translate = makeTranslator(this.data.locale);
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: translate('modal.confirmProceeding.title'),
        content: translate('modal.confirmProceeding.content'),
        success: result => resolve(Boolean(result.confirm))
      });
    });

    if (!confirmed) {
      return;
    }

    try {
      await notifyActivityParticipants(activityId, 'proceeding');
      wx.showToast({
        title: translate('toast.activityConfirmed'),
        icon: 'success'
      });
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
