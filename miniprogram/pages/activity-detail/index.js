const {
  getActivityDetail,
  cancelActivity,
  resolveActivityCoverImage
} = require('../../services/activity-service');
const { cancelRegistration, removeRegistration } = require('../../services/registration-service');
const { buildTeamListVm } = require('../../utils/formatters');
const {
  getAppLocale,
  getMessages,
  makeTranslator,
  setPageNavigationTitle,
  translateErrorMessage
} = require('../../utils/i18n');

function consumeRefreshFlag(activityId) {
  if (typeof getApp !== 'function') {
    return false;
  }

  const app = getApp();
  if (!app.globalData) {
    app.globalData = {};
  }

  if (!app.globalData.activityDetailRefreshFlags) {
    app.globalData.activityDetailRefreshFlags = {};
  }

  if (!app.globalData.activityDetailRefreshFlags[activityId]) {
    return false;
  }

  app.globalData.activityDetailRefreshFlags[activityId] = false;
  return true;
}

function applyPageI18n(page) {
  const locale = getAppLocale();
  const i18n = getMessages(locale);
  setPageNavigationTitle('nav.activityDetail', locale);
  page.setData({ locale, i18n });
  return makeTranslator(locale);
}

function buildLocationMapState(activity = {}) {
  const location = activity.location;
  const hasCoordinates =
    location &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number';

  if (!hasCoordinates) {
    return {
      locationMapVisible: false,
      locationMapMarkers: []
    };
  }

  return {
    locationMapVisible: true,
    locationMapMarkers: [
      {
        id: 1,
        latitude: location.latitude,
        longitude: location.longitude,
        title: activity.addressName || activity.addressText || '',
        iconPath: '/assets/location-pin.png',
        width: 28,
        height: 32
      }
    ]
  };
}

Page({
  data: {
    activityId: '',
    activity: null,
    teams: [],
    myRegistration: null,
    viewer: null,
    locale: '',
    i18n: {},
    shareHintVisible: false,
    needsReloadOnShow: false,
    locationMapVisible: false,
    locationMapMarkers: []
  },

  async onLoad(query) {
    const shareHintVisible = query.fromPublish === '1';

    this.setData({
      activityId: query.activityId,
      shareHintVisible
    });

    if (shareHintVisible && typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }

    applyPageI18n(this);
    await this.reload();
  },

  async onShow() {
    applyPageI18n(this);
    const shouldReload = this.data.needsReloadOnShow || consumeRefreshFlag(this.data.activityId);

    if (!shouldReload) {
      return;
    }

    this.setData({ needsReloadOnShow: false });
    await this.reload();
  },

  async reload() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const detail = await getActivityDetail(this.data.activityId);
    const activityWithDisplayCover = await resolveActivityCoverImage(detail.activity);
    this.setData({
      ...detail,
      activity: activityWithDisplayCover,
      ...buildLocationMapState(activityWithDisplayCover),
      teams: buildTeamListVm(
        detail.teams,
        detail.myRegistration,
        activityWithDisplayCover,
        undefined,
        translate,
        {
          canCancelSignup: Boolean(detail.viewer && detail.viewer.canCancelSignup),
          canManageRegistrations: Boolean(detail.viewer && detail.viewer.canManageRegistrations)
        }
      )
    });
  },

  openSignup(event) {
    const selectedTeam = this.data.teams.find(team => team._id === event.detail.teamId);
    if (!selectedTeam || selectedTeam.joinDisabled) {
      return;
    }

    wx.navigateTo({
      url:
        `/pages/activity-join/index?activityId=${this.data.activityId}` +
        `&teamId=${selectedTeam._id}` +
        `&teamName=${encodeURIComponent(selectedTeam.teamName)}` +
        `&requirePhone=${this.data.activity && this.data.activity.requirePhone ? '1' : '0'}`,
      events: {
        signupSuccess: () => {
          this.setData({ needsReloadOnShow: true });
        }
      }
    });
  },

  openEditActivity() {
    wx.navigateTo({
      url: `/pages/activity-create/index?mode=edit&activityId=${this.data.activityId}`
    });
  },

  async onCancelSignup() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    try {
      await cancelRegistration(this.data.activityId);
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  async onRemoveRegistration(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const detail = event.detail || {};

    if (!detail.userOpenId) {
      return;
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: translate('modal.removeRegistration.title'),
        content: translate('modal.removeRegistration.content', {
          name: detail.signupName || translate('modal.removeRegistration.defaultName')
        }),
        success: result => resolve(Boolean(result.confirm))
      });
    });

    if (!confirmed) {
      return;
    }

    try {
      await removeRegistration(this.data.activityId, detail.userOpenId);
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  async onCancelActivity() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
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
      await cancelActivity(this.data.activityId);
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  onOpenLocation() {
    const activity = this.data.activity;
    const location = activity && activity.location;

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      wx.showToast({
        title: makeTranslator(this.data.locale || getAppLocale())('toast.locationPinUnavailable'),
        icon: 'none'
      });
      return;
    }

    wx.openLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      name: activity.addressName || activity.addressText,
      address: activity.addressText,
      scale: 16
    });
  },

  onShareAppMessage() {
    const activity = this.data.activity || {};
    const translate = makeTranslator(this.data.locale || getAppLocale());

    return {
      title: activity.title || translate('nav.home'),
      imageUrl: activity.coverImage || undefined,
      path: `/pages/activity-detail/index?activityId=${this.data.activityId}`
    };
  },

  onShareTimeline() {
    const activity = this.data.activity || {};
    const translate = makeTranslator(this.data.locale || getAppLocale());

    return {
      title: activity.title || translate('nav.home'),
      imageUrl: activity.coverImage || undefined,
      query: `activityId=${this.data.activityId}`
    };
  }
});
