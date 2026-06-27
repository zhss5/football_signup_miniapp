const {
  deleteActivity,
  listActivities,
  resolveActivityCoverImages
} = require('../../services/activity-service');
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

function formatTimeOfDay(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function buildCreatedActivityTags(item = {}, translate) {
  const activityType = item.activityType === 'external' ? 'external' : 'internal';
  const confirmStatus = item.confirmStatus === 'confirmed' ? 'confirmed' : 'pending';
  const signupDeadlineTime = formatTimeOfDay(item.signupDeadlineAt);
  const tags = [
    {
      key: 'activityType',
      label: translate(`activityCreate.activityTypes.${activityType}`),
      tone: 'type'
    },
    {
      key: 'confirmStatus',
      label: translate(`activity.status.${confirmStatus}`),
      tone: confirmStatus
    }
  ];

  if (signupDeadlineTime) {
    tags.push({
      key: 'signupDeadline',
      label: `${translate('activityCreate.signupDeadline')} ${signupDeadlineTime}`,
      tone: 'deadline'
    });
  }

  return tags;
}

function buildCreatedFilterOptions(filters = [], selectedKey, items = []) {
  return filters.map(filter => ({
    ...filter,
    count: items.filter(item => matchesCreatedFilter(item, filter.key)).length,
    selected: filter.key === selectedKey
  }));
}

function resolveCreatedFilterLabel(filterOptions = [], filterKey) {
  const matched = filterOptions.find(item => item.key === filterKey);
  return matched ? matched.label : '';
}

function prepareMyActivityItems(items = [], translate, scope = '') {
  return items
    .map(item => {
      const prepared = buildActivityCardVm(item, undefined, translate);
      if (scope !== 'created') {
        return prepared;
      }

      return {
        ...prepared,
        activityTags: buildCreatedActivityTags(prepared, translate)
      };
    })
    .sort(compareStartDesc);
}

function getLanguageToolbarState(locale, languageOptions = []) {
  const current = languageOptions.find(item => item.key === locale) || languageOptions[0] || {};
  return {
    currentLanguageLabel: current.label || '',
    nextLocale: locale === 'zh-CN' ? 'en-US' : 'zh-CN'
  };
}

Page({
  data: {
    locale: '',
    i18n: {},
    filterLabel: '',
    languageOptions: [],
    currentLanguageLabel: '',
    nextLocale: 'zh-CN',
    activeTab: 'joined',
    showCreatedActivitiesTab: false,
    tabs: [],
    createdFilter: 'all',
    createdFilters: [],
    createdFilterDropdownVisible: false,
    createdFilterOptions: [],
    currentCreatedFilterLabel: '',
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
    const languageOptions = buildLanguageOptions(locale);
    const languageToolbarState = getLanguageToolbarState(locale, languageOptions);
    setPageNavigationTitle('nav.myActivities', locale);
    this.setData({
      locale,
      i18n,
      filterLabel: i18n.my.filterLabel,
      languageOptions,
      ...languageToolbarState,
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
    this.applyCreatedFilter(this.data.createdFilter, this.data.createdItemsAll);
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
    const showCreatedActivitiesTab = await this.refreshUserProfile();
    const requests = [
      this.loadMyActivityList('joined', translate, loadToken)
    ];
    if (showCreatedActivitiesTab) {
      requests.push(this.loadMyActivityList('created', translate, loadToken));
    } else {
      this.setData({
        createdItemsAll: [],
        createdItems: [],
        createdFilterDropdownVisible: false,
        createdFilterOptions: [],
        currentCreatedFilterLabel: ''
      });
    }
    await Promise.all(requests);
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
    const preparedItems = prepareMyActivityItems(items, translate, scope);

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
      const showCreatedActivitiesTab = canCreateActivity(user);
      const shouldPreserveActiveTab =
        showCreatedActivitiesTab &&
        this.data.showCreatedActivitiesTab &&
        (this.data.activeTab === 'created' || this.data.activeTab === 'joined');
      this.setData({
        userOpenId: user && user._id ? user._id : '',
        userRoleText: formatRoles(user),
        canConfirmWebAdminLogin: showCreatedActivitiesTab,
        showCreatedActivitiesTab,
        activeTab: showCreatedActivitiesTab
          ? (shouldPreserveActiveTab ? this.data.activeTab : 'created')
          : 'joined'
      });
      return showCreatedActivitiesTab;
    } catch (error) {
      this.setData({
        userOpenId: '',
        userRoleText: '',
        canConfirmWebAdminLogin: false,
        showCreatedActivitiesTab: false,
        activeTab: 'joined'
      });
      return false;
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
    const createdFilterOptions = buildCreatedFilterOptions(
      this.data.createdFilters,
      filterKey,
      items
    );

    this.setData({
      createdFilter: filterKey,
      createdItems,
      createdFilterOptions,
      currentCreatedFilterLabel: resolveCreatedFilterLabel(createdFilterOptions, filterKey)
    });
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/activity-detail/index?activityId=${event.detail.id}` });
  },

  onTabChange(event) {
    const activeTab = event.currentTarget.dataset.tabKey;
    if (activeTab === 'created' && !this.data.showCreatedActivitiesTab) {
      return;
    }
    this.setData({
      activeTab,
      createdFilterDropdownVisible: false
    });
  },

  onCreatedFilterToggle() {
    this.setData({
      createdFilterDropdownVisible: !this.data.createdFilterDropdownVisible
    });
  },

  onCreatedFilterSelect(event) {
    const filterKey = event.currentTarget.dataset.filterKey;
    this.applyCreatedFilter(filterKey);
    this.setData({
      createdFilterDropdownVisible: false
    });
  },

  async loadMoreMyActivities(eventOrScope) {
    const scope =
      typeof eventOrScope === 'string'
        ? eventOrScope
        : eventOrScope.currentTarget.dataset.scope;
    if (scope === 'created' && !this.data.showCreatedActivitiesTab) {
      return;
    }
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
