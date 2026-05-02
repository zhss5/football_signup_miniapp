const {
  getActivityDetail,
  cancelActivity,
  resolveActivityCoverImage
} = require('../../services/activity-service');
const {
  addProxyRegistration,
  cancelRegistration,
  moveRegistration,
  removeRegistration
} = require('../../services/registration-service');
const { notifyActivityParticipants } = require('../../services/notification-service');
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

function buildParticipantNameList(teams = []) {
  return teams.reduce((names, team) => {
    const members = Array.isArray(team.members) ? team.members : [];

    members.forEach(member => {
      const name = String(member.signupName || member.displayName || '').trim();

      if (name) {
        names.push(name);
      }
    });

    return names;
  }, []);
}

function buildMoveTargetOptions(teams = [], currentTeamId, translate) {
  return teams
    .filter(team => {
      if (!team || team._id === currentTeamId) {
        return false;
      }

      return Number(team.joinedCount || 0) < Number(team.maxMembers || 0);
    })
    .map(team => ({
      teamId: team._id,
      label: translate('activity.moveTarget.label', {
        teamName: team.teamName,
        joined: team.joinedCount || 0,
        total: team.maxMembers || 0
      })
    }));
}

function buildCoverCandidates(activity = {}) {
  if (Array.isArray(activity.coverImageSources) && activity.coverImageSources.length > 0) {
    return activity.coverImageSources.filter(Boolean);
  }

  return [activity.coverDisplayImage].filter(Boolean);
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
    locationMapMarkers: [],
    activityCoverCandidates: [],
    activityCoverImage: '',
    activityCoverLoadFailed: false,
    activityCoverSourceIndex: 0
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
    const activityCoverCandidates = buildCoverCandidates(activityWithDisplayCover);
    this.setData({
      ...detail,
      activity: activityWithDisplayCover,
      activityCoverCandidates,
      activityCoverImage: activityCoverCandidates[0] || '',
      activityCoverLoadFailed: false,
      activityCoverSourceIndex: 0,
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

  onActivityCoverError() {
    const nextIndex = this.data.activityCoverSourceIndex + 1;
    const nextCoverImage = this.data.activityCoverCandidates[nextIndex] || '';

    if (nextCoverImage) {
      this.setData({
        activityCoverImage: nextCoverImage,
        activityCoverSourceIndex: nextIndex
      });
      return;
    }

    this.setData({ activityCoverLoadFailed: true });
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
        `&teamName=${encodeURIComponent(selectedTeam.teamName)}`,
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

  async onProxySignup(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const detail = event.detail || {};

    if (!detail.teamId) {
      return;
    }

    const signupName = await new Promise(resolve => {
      wx.showModal({
        title: translate('modal.proxySignup.title'),
        content: detail.teamName || '',
        editable: true,
        placeholderText: translate('modal.proxySignup.placeholder'),
        success: result => resolve(result.confirm ? String(result.content || '').trim() : null)
      });
    });

    if (signupName === null) {
      return;
    }

    if (!signupName) {
      wx.showToast({
        title: translate('errors.signupNameRequired'),
        icon: 'none'
      });
      return;
    }

    try {
      await addProxyRegistration(this.data.activityId, detail.teamId, signupName);
      wx.showToast({
        title: translate('toast.proxySignupSuccess'),
        icon: 'success'
      });
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  async onMoveRegistration(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const detail = event.detail || {};

    if (!detail.userOpenId || !detail.currentTeamId) {
      return;
    }

    const targets = buildMoveTargetOptions(this.data.teams, detail.currentTeamId, translate);
    if (targets.length === 0) {
      wx.showToast({
        title: translate('toast.noMoveTargetTeam'),
        icon: 'none'
      });
      return;
    }

    const tapIndex = await new Promise(resolve => {
      wx.showActionSheet({
        itemList: targets.map(item => item.label),
        success: result => resolve(result.tapIndex),
        fail: () => resolve(-1)
      });
    });

    if (tapIndex < 0 || !targets[tapIndex]) {
      return;
    }

    try {
      await moveRegistration(this.data.activityId, detail.userOpenId, targets[tapIndex].teamId);
      wx.showToast({
        title: translate('toast.moveRegistrationSuccess'),
        icon: 'success'
      });
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  async onConfirmActivityProceeding() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
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
      await notifyActivityParticipants(this.data.activityId, 'proceeding');
      wx.showToast({
        title: translate('toast.activityConfirmed'),
        icon: 'success'
      });
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  onCopyParticipantNames() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const names = buildParticipantNameList(this.data.teams);

    if (names.length === 0) {
      wx.showToast({
        title: translate('toast.noParticipantsToCopy'),
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: names.join('\n'),
      success: () => {
        wx.showToast({
          title: translate('toast.participantNamesCopied'),
          icon: 'success'
        });
      }
    });
  },

  onOpenInsuranceLink() {
    const activity = this.data.activity || {};
    const insuranceLink = String(activity.insuranceLink || '').trim();

    if (!insuranceLink) {
      return;
    }

    wx.navigateTo({
      url: `/pages/insurance-webview/index?url=${encodeURIComponent(insuranceLink)}`
    });
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
      try {
        await notifyActivityParticipants(this.data.activityId, 'cancelled');
      } catch (notifyError) {
        wx.showToast({
          title: translate('toast.notificationFailed'),
          icon: 'none'
        });
      }
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
