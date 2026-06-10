const {
  getActivityDetail,
  cancelActivity,
  setRegistrationAttendance,
  updateTeamColor,
  updateParticipantManagerAlias,
  resolveActivityCoverImage
} = require('../../services/activity-service');
const {
  addProxyRegistration,
  cancelRegistration,
  moveRegistration,
  removeRegistration
} = require('../../services/registration-service');
const {
  getManagerRegistrationNoticeTemplateId,
  notifyActivityParticipants,
  requestManagerRegistrationNotificationSubscription
} = require('../../services/notification-service');
const { downloadFile } = require('../../services/cloud');
const {
  buildTeamListVm,
  formatDateTime,
  getActivitySignupState,
  isActivityExpired
} = require('../../utils/formatters');
const { TEAM_COLOR_OPTIONS, isTeamColorKey } = require('../../utils/team-colors');
const {
  MAX_PREFERRED_POSITIONS,
  POSITION_VALUES,
  buildPositionOptions,
  normalizePreferredPositions
} = require('../../utils/positions');
const { normalizeSignupName } = require('../../utils/signup-name');
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

function buildActivityTimeText(activity = {}) {
  const startText = formatDateTime(activity.startAt);
  const endText = formatDateTime(activity.endAt);

  if (startText && endText) {
    if (startText.slice(0, 10) === endText.slice(0, 10) && endText.length > 11) {
      return `${startText}-${endText.slice(11)}`;
    }

    return `${startText} - ${endText}`;
  }

  return startText || endText;
}

function buildParticipantNameList(teams = []) {
  return teams.reduce((names, team) => {
    const members = Array.isArray(team.members) ? team.members : [];

    members.forEach(member => {
      const name = String(member.signupName || member.displayName || '').trim();

      if (name) {
        const positionsText = buildParticipantPositionsText(member);
        names.push(positionsText ? `${name} (${positionsText})` : name);
      }
    });

    return names;
  }, []);
}

function buildParticipantPositionsText(member = {}) {
  if (member.preferredPositionsVisible === false) {
    return '';
  }

  const existingText = String(member.preferredPositionsText || '').trim();
  if (existingText) {
    return existingText;
  }

  if (!Array.isArray(member.preferredPositions)) {
    return '';
  }

  return member.preferredPositions
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(' / ');
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

function getShareImageUrl(activity = {}) {
  return activity.shareDisplayImage || activity.coverDisplayImage || activity.coverImage || undefined;
}

function buildActivityShareTitle(activity = {}, translate) {
  const baseTitle = activity.title || translate('nav.home');
  const timeText = buildActivityTimeText(activity);

  return timeText ? `${baseTitle}\n${timeText}` : baseTitle;
}

function buildColorPaletteOptions(translate) {
  return TEAM_COLOR_OPTIONS.map(option => ({
    ...option,
    label: translate(option.labelKey)
  }));
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://');
}

function normalizeViewerRegistrationNotificationState(viewer = {}) {
  const expectedTemplateId = getManagerRegistrationNoticeTemplateId();

  if (!viewer || !viewer.registrationNotificationSubscribed || !expectedTemplateId) {
    return viewer;
  }

  const savedTemplateId = String(
    viewer.registrationNotificationSubscriptionTemplateId || ''
  ).trim();

  if (savedTemplateId === expectedTemplateId) {
    return viewer;
  }

  return {
    ...viewer,
    registrationNotificationSubscribed: false
  };
}

async function resolveCoverCandidate(candidate) {
  if (!isCloudFileId(candidate)) {
    return candidate || '';
  }

  const tempFilePath = await downloadFile(candidate).catch(() => '');
  return tempFilePath || candidate;
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
    activityCoverSourceIndex: 0,
    activityTimeText: '',
    activityDescriptionText: '',
    activityDetailImages: [],
    activityExpiredVisible: false,
    activitySignupClosedVisible: false,
    colorPaletteVisible: false,
    colorPaletteTeamId: '',
    colorPaletteOptions: [],
    proxySignupVisible: false,
    proxySignupTeamId: '',
    proxySignupTeamName: '',
    proxySignupName: '',
    proxySignupPreferredPositions: [],
    proxySignupPositionOptions: buildPositionOptions([]),
    proxySignupSubmitting: false
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
    const activityDescriptionText = String(activityWithDisplayCover.description || '').trim();
    const activityDetailImages = Array.isArray(activityWithDisplayCover.detailDisplayImages)
      ? activityWithDisplayCover.detailDisplayImages.filter(Boolean)
      : [];
    const signupState = getActivitySignupState(
      activityWithDisplayCover,
      undefined,
      translate
    );
    this.setData({
      ...detail,
      viewer: normalizeViewerRegistrationNotificationState(detail.viewer),
      activity: activityWithDisplayCover,
      activityDescriptionText,
      activityCoverCandidates,
      activityCoverImage: activityCoverCandidates[0] || '',
      activityCoverLoadFailed: false,
      activityCoverSourceIndex: 0,
      activityTimeText: buildActivityTimeText(activityWithDisplayCover),
      ...buildLocationMapState(activityWithDisplayCover),
      activityDetailImages,
      activityExpiredVisible: isActivityExpired(activityWithDisplayCover),
      activitySignupClosedVisible: signupState.stateKey === 'signupClosed',
      teams: buildTeamListVm(
        detail.teams,
        detail.myRegistration,
        activityWithDisplayCover,
        undefined,
        translate,
        {
          canCancelSignup: Boolean(detail.viewer && detail.viewer.canCancelSignup),
          canEditTeamColor: Boolean(detail.viewer && detail.viewer.canEditActivity),
          canManageRegistrations: Boolean(detail.viewer && detail.viewer.canManageRegistrations)
        }
      )
    });
  },

  async onActivityCoverError() {
    const nextIndex = this.data.activityCoverSourceIndex + 1;
    const nextCoverImage = this.data.activityCoverCandidates[nextIndex] || '';

    if (nextCoverImage) {
      const resolvedCoverImage = await resolveCoverCandidate(nextCoverImage);

      if (!resolvedCoverImage) {
        this.setData({
          activityCoverSourceIndex: nextIndex
        });
        this.onActivityCoverError();
        return;
      }

      this.setData({
        activityCoverImage: resolvedCoverImage,
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

  onCopyActivity() {
    wx.navigateTo({
      url: `/pages/activity-create/index?mode=copy&activityId=${this.data.activityId}`
    });
  },

  onTeamColorTap(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const viewer = this.data.viewer || {};

    if (!viewer.canEditActivity) {
      return;
    }

    const teamId = event.detail && event.detail.teamId;
    if (!teamId) {
      return;
    }

    this.setData({
      colorPaletteVisible: true,
      colorPaletteTeamId: teamId,
      colorPaletteOptions: buildColorPaletteOptions(translate)
    });
  },

  async onColorPaletteSelect(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const colorKey = String(event.currentTarget.dataset.colorKey || '').trim();
    const teamId = this.data.colorPaletteTeamId;

    if (!teamId || !isTeamColorKey(colorKey)) {
      return;
    }

    try {
      this.closeColorPalette();
      await updateTeamColor(this.data.activityId, teamId, colorKey);
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  closeColorPalette() {
    this.setData({
      colorPaletteVisible: false,
      colorPaletteTeamId: ''
    });
  },

  onColorPaletteCancel() {
    this.closeColorPalette();
  },

  noop() {},

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

  async onAttendanceChange(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const detail = event.detail || {};

    if (!detail.registrationId || !detail.attendanceStatus) {
      return;
    }

    try {
      await setRegistrationAttendance(
        this.data.activityId,
        detail.registrationId,
        detail.attendanceStatus
      );
      wx.showToast({
        title: translate('toast.attendanceUpdated'),
        icon: 'success'
      });
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  async onManagerAliasEdit(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const detail = event.detail || {};

    if (!detail.userOpenId) {
      return;
    }

    const promptResult = await new Promise(resolve => {
      wx.showModal({
        title: translate('modal.managerAlias.title'),
        content: translate('modal.managerAlias.content', {
          name: detail.signupName || translate('modal.managerAlias.defaultName')
        }),
        editable: true,
        placeholderText: translate('modal.managerAlias.placeholder'),
        success: result => resolve(result),
        fail: () => resolve({ confirm: false })
      });
    });

    if (!promptResult.confirm) {
      return;
    }

    const managerAlias = String(promptResult.content || '').trim();

    try {
      await updateParticipantManagerAlias(this.data.activityId, detail.userOpenId, managerAlias);
      wx.showToast({
        title: translate('toast.managerAliasUpdated'),
        icon: 'success'
      });
      await this.reload();
    } catch (error) {
      wx.showToast({ title: translateErrorMessage(error, translate), icon: 'none' });
    }
  },

  onProxySignup(event) {
    const detail = event.detail || {};

    if (!detail.teamId) {
      return;
    }

    this.setData({
      proxySignupVisible: true,
      proxySignupTeamId: detail.teamId,
      proxySignupTeamName: detail.teamName || '',
      proxySignupName: '',
      proxySignupPreferredPositions: [],
      proxySignupPositionOptions: buildPositionOptions([]),
      proxySignupSubmitting: false
    });
  },

  onProxySignupNameInput(event) {
    this.setData({
      proxySignupName: event.detail.value
    });
  },

  onProxySignupPositionTap(event) {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const value = String(event.currentTarget.dataset.value || '').trim();

    if (!POSITION_VALUES.includes(value)) {
      return;
    }

    const current = normalizePreferredPositions(this.data.proxySignupPreferredPositions);
    const next = current.includes(value)
      ? current.filter(item => item !== value)
      : current.length < MAX_PREFERRED_POSITIONS
        ? current.concat(value)
        : current;

    if (!current.includes(value) && current.length >= MAX_PREFERRED_POSITIONS) {
      wx.showToast({
        title: translate('activityJoin.preferredPositionsLimit'),
        icon: 'none'
      });
      return;
    }

    this.setData({
      proxySignupPreferredPositions: next,
      proxySignupPositionOptions: buildPositionOptions(next)
    });
  },

  onProxySignupCancel() {
    if (this.data.proxySignupSubmitting) {
      return;
    }

    this.closeProxySignup();
  },

  closeProxySignup() {
    this.setData({
      proxySignupVisible: false,
      proxySignupTeamId: '',
      proxySignupTeamName: '',
      proxySignupName: '',
      proxySignupPreferredPositions: [],
      proxySignupPositionOptions: buildPositionOptions([]),
      proxySignupSubmitting: false
    });
  },

  async onProxySignupSubmit() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const signupName = normalizeSignupName(this.data.proxySignupName);
    const preferredPositions = normalizePreferredPositions(this.data.proxySignupPreferredPositions);

    if (!signupName) {
      wx.showToast({
        title: translate('errors.signupNameRequired'),
        icon: 'none'
      });
      return;
    }

    try {
      this.setData({ proxySignupSubmitting: true });
      await addProxyRegistration(
        this.data.activityId,
        this.data.proxySignupTeamId,
        signupName,
        preferredPositions
      );
      wx.showToast({
        title: translate('toast.proxySignupSuccess'),
        icon: 'success'
      });
      this.closeProxySignup();
      await this.reload();
    } catch (error) {
      this.setData({ proxySignupSubmitting: false });
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

  async onSubscribeRegistrationNotifications() {
    const translate = makeTranslator(this.data.locale || getAppLocale());
    const viewer = this.data.viewer || {};

    if (viewer.registrationNotificationSubscribed) {
      return;
    }

    try {
      const result = await requestManagerRegistrationNotificationSubscription(this.data.activityId);
      const accepted = result && (result.status === 'accepted' || result.subscribed);

      if (accepted) {
        this.setData({
          viewer: {
            ...viewer,
            registrationNotificationSubscribed: true,
            registrationNotificationSubscriptionTemplateId:
              result.templateId || viewer.registrationNotificationSubscriptionTemplateId || ''
          }
        });
      }

      wx.showToast({
        title: accepted
          ? translate('toast.registrationNotificationSubscribed')
          : translate('toast.registrationNotificationNotEnabled'),
        icon: accepted ? 'success' : 'none'
      });
    } catch (error) {
      wx.showToast({
        title: translate('toast.notificationFailed'),
        icon: 'none'
      });
    }
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

  onPreviewDetailImage(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    const urls = this.data.activityDetailImages || [];

    if (urls.length === 0) {
      return;
    }

    wx.previewImage({
      current: urls[index] || urls[0],
      urls
    });
  },

  onPreviewActivityCover() {
    const coverImage = this.data.activityCoverImage;

    if (!coverImage) {
      return;
    }

    wx.previewImage({
      current: coverImage,
      urls: [coverImage]
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
      title: buildActivityShareTitle(activity, translate),
      imageUrl: getShareImageUrl(activity),
      path: `/pages/activity-detail/index?activityId=${this.data.activityId}`
    };
  },

  onShareTimeline() {
    const activity = this.data.activity || {};
    const translate = makeTranslator(this.data.locale || getAppLocale());

    return {
      title: buildActivityShareTitle(activity, translate),
      imageUrl: getShareImageUrl(activity),
      query: `activityId=${this.data.activityId}`
    };
  }
});
