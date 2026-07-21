jest.mock('../../../miniprogram/services/activity-service', () => ({
  getActivityDetail: jest.fn(),
  cancelActivity: jest.fn(),
  setRegistrationAttendance: jest.fn(),
  updateParticipantManagerAlias: jest.fn(),
  updateTeamColor: jest.fn(),
  resolveActivityCoverImage: jest.fn(activity => Promise.resolve(activity))
}));

jest.mock('../../../miniprogram/services/registration-service', () => ({
  addProxyRegistration: jest.fn(),
  cancelRegistration: jest.fn(),
  moveRegistration: jest.fn(),
  removeRegistration: jest.fn()
}));

jest.mock('../../../miniprogram/utils/formatters', () => ({
  buildTeamListVm: jest.fn((teams) => teams),
  formatDateTime: jest.fn(value => {
    const map = {
      '2026-05-13T12:00:00.000Z': '2026-05-13 20:00',
      '2026-05-13T14:00:00.000Z': '2026-05-13 22:00'
    };

    return map[value] || '';
  }),
  getActivitySignupState: jest.fn(() => ({
    statusText: 'Joinable',
    joinEnabled: true,
    isExpired: false
  })),
  isActivityExpired: jest.fn(activity => {
    const endAt = Date.parse(activity.endAt || '');
    return Number.isFinite(endAt) && Date.now() > endAt;
  })
}));

jest.mock('../../../miniprogram/services/notification-service', () => ({
  getManagerRegistrationNoticeTemplateId: jest.fn(() => 'tmpl_manager_current'),
  notifyActivityParticipants: jest.fn(),
  requestActivityNotificationSubscription: jest.fn(),
  requestManagerRegistrationNotificationSubscription: jest.fn()
}));

const fs = require('fs');
const path = require('path');

describe('activity detail page', () => {
  let pageConfig;
  let getActivityDetail;
  let cancelActivity;
  let setRegistrationAttendance;
  let updateParticipantManagerAlias;
  let updateTeamColor;
  let addProxyRegistration;
  let cancelRegistration;
  let moveRegistration;
  let removeRegistration;
  let buildTeamListVm;
  let formatDateTime;
  let getActivitySignupState;
  let resolveActivityCoverImage;
  let notifyActivityParticipants;
  let getManagerRegistrationNoticeTemplateId;
  let requestActivityNotificationSubscription;
  let requestManagerRegistrationNotificationSubscription;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      navigateTo: jest.fn(),
      showToast: jest.fn(),
      showModal: jest.fn(),
      showShareMenu: jest.fn(),
      previewImage: jest.fn(),
      setClipboardData: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/activity-detail/index');
    ({ getActivityDetail } = require('../../../miniprogram/services/activity-service'));
    ({ cancelActivity } = require('../../../miniprogram/services/activity-service'));
    ({
      setRegistrationAttendance
    } = require('../../../miniprogram/services/activity-service'));
    ({
      updateParticipantManagerAlias
    } = require('../../../miniprogram/services/activity-service'));
    ({ updateTeamColor } = require('../../../miniprogram/services/activity-service'));
    ({ resolveActivityCoverImage } = require('../../../miniprogram/services/activity-service'));
    ({ addProxyRegistration } = require('../../../miniprogram/services/registration-service'));
    ({ cancelRegistration } = require('../../../miniprogram/services/registration-service'));
    ({ moveRegistration } = require('../../../miniprogram/services/registration-service'));
    ({ removeRegistration } = require('../../../miniprogram/services/registration-service'));
    ({ buildTeamListVm } = require('../../../miniprogram/utils/formatters'));
    ({ formatDateTime } = require('../../../miniprogram/utils/formatters'));
    ({ getActivitySignupState } = require('../../../miniprogram/utils/formatters'));
    ({
      getManagerRegistrationNoticeTemplateId,
      notifyActivityParticipants,
      requestActivityNotificationSubscription,
      requestManagerRegistrationNotificationSubscription
    } = require('../../../miniprogram/services/notification-service'));
    notifyActivityParticipants.mockResolvedValue({
      sent: 0,
      failed: 0
    });
    requestActivityNotificationSubscription.mockResolvedValue({
      configured: true,
      status: 'accepted'
    });
    requestManagerRegistrationNotificationSubscription.mockResolvedValue({
      configured: true,
      templateId: 'tmpl_manager_current',
      status: 'accepted'
    });
    getActivitySignupState.mockReturnValue({
      statusText: 'Joinable',
      joinEnabled: true,
      isExpired: false
    });
    getManagerRegistrationNoticeTemplateId.mockReturnValue('tmpl_manager_current');
  });

  test('openSignup stores the selected team name so the sheet can show which team is being joined', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        activity: {},
        teams: [
          { _id: 'team_white', teamName: 'White', joinDisabled: false },
          { _id: 'team_red', teamName: 'Red', joinDisabled: false }
        ]
      }
    };

    global.wx.navigateTo = jest.fn();

    pageConfig.openSignup.call(ctx, {
      detail: {
        teamId: 'team_red'
      }
    });

    expect(global.wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/activity-join/index?activityId=activity_123&teamId=team_red&teamName=Red',
      events: {
        signupSuccess: expect.any(Function)
      }
    });
  });

  test('onTeamColorTap lets managers choose a color and reloads detail', async () => {
    updateTeamColor.mockResolvedValue({ updated: true });
    global.wx.showActionSheet = jest.fn();

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        viewer: {
          canEditActivity: true
        },
        teams: [
          {
            _id: 'team_white',
            teamName: 'White'
          }
        ]
      },
      reload: jest.fn().mockResolvedValue(),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onTeamColorTap.call(ctx, {
      detail: {
        teamId: 'team_white'
      }
    });

    expect(ctx.data.colorPaletteVisible).toBe(true);
    expect(ctx.data.colorPaletteTeamId).toBe('team_white');
    expect(ctx.data.colorPaletteOptions.map(item => item.key)).toEqual([
      'green',
      'white',
      'red',
      'blue',
      'black',
      'yellow',
      'orange',
      'purple',
      'gray',
      'pink'
    ]);
    expect(global.wx.showActionSheet).not.toHaveBeenCalled();
    expect(updateTeamColor).not.toHaveBeenCalled();
    expect(ctx.reload).not.toHaveBeenCalled();
  });

  test('onColorPaletteSelect updates the selected team color and reloads detail', async () => {
    updateTeamColor.mockResolvedValue({ updated: true });
    const ctx = {
      data: {
        activityId: 'activity_123',
        colorPaletteTeamId: 'team_white',
        locale: 'en-US'
      },
      reload: jest.fn().mockResolvedValue(),
      closeColorPalette: pageConfig.closeColorPalette,
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onColorPaletteSelect.call(ctx, {
      currentTarget: {
        dataset: {
          colorKey: 'orange'
        }
      }
    });

    expect(updateTeamColor).toHaveBeenCalledWith('activity_123', 'team_white', 'orange');
    expect(ctx.data.colorPaletteVisible).toBe(false);
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('activity detail renders a custom team color palette', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{colorPaletteVisible}}"');
    expect(wxml).toContain('wx:for="{{colorPaletteOptions}}"');
    expect(wxml).toContain('bindtap="onColorPaletteSelect"');
    expect(wxml).toContain('class="team-kit-icon {{item.className}}"');
    expect(wxml).toContain('team-kit-body');
  });

  test('onShow reloads detail after returning from a successful join flow', async () => {
    const ctx = {
      data: {
        needsReloadOnShow: true
      },
      reload: jest.fn().mockResolvedValue(),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.needsReloadOnShow).toBe(false);
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('onShow reloads detail when a global refresh flag was set by the join page', async () => {
    const app = {
      globalData: {
        activityDetailRefreshFlags: {
          activity_123: true
        }
      }
    };
    global.getApp = jest.fn(() => app);

    const ctx = {
      data: {
        activityId: 'activity_123',
        needsReloadOnShow: false
      },
      reload: jest.fn().mockResolvedValue(),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onShow.call(ctx);

    expect(ctx.reload).toHaveBeenCalled();
    expect(app.globalData.activityDetailRefreshFlags.activity_123).toBe(false);
  });

  test('onLoad keeps the post-publish share hint visible and enables share menus after redirecting from create activity', async () => {
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Thursday Match',
        status: 'published'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        isOrganizer: true
      }
    });

    const ctx = {
      data: {
        activityId: '',
        shareHintVisible: false
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      reload: pageConfig.reload
    };

    await pageConfig.onLoad.call(ctx, {
      activityId: 'activity_123',
      fromPublish: '1'
    });

    expect(ctx.data.activityId).toBe('activity_123');
    expect(ctx.data.shareHintVisible).toBe(true);
    expect(global.wx.showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline']
    });
  });

  test('reload builds a map marker when the activity has a selected location', async () => {
    resolveActivityCoverImage.mockImplementation(activity =>
      Promise.resolve({
        ...activity,
        coverDisplayImage: 'https://tmp.example.com/cover.jpg'
      })
    );
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Thursday Match',
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
        addressName: 'Pitch Gate',
        addressText: '123 Field Road',
        location: {
          latitude: 31.2,
          longitude: 121.4
        },
        status: 'published'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        isOrganizer: true
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(resolveActivityCoverImage).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg'
      })
    );
    expect(ctx.data.activity.coverDisplayImage).toBe('https://tmp.example.com/cover.jpg');
    expect(ctx.data.locationMapVisible).toBe(true);
    expect(ctx.data.locationMapMarkers).toEqual([
      expect.objectContaining({
        id: 1,
        latitude: 31.2,
        longitude: 121.4,
        title: 'Pitch Gate',
        iconPath: '/assets/location-pin.png',
        width: 28,
        height: 32
      })
    ]);
  });

  test('reload exposes an expired activity banner when the activity end time has passed', async () => {
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Past Match',
        status: 'published',
        endAt: '2000-01-01T10:00:00.000Z'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        isOrganizer: true
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(ctx.data.activityExpiredVisible).toBe(true);
  });

  test('reload exposes a signup closed banner when signup deadline has passed', async () => {
    getActivitySignupState.mockReturnValue({
      statusText: 'Signup Closed',
      joinEnabled: false,
      isExpired: false,
      stateKey: 'signupClosed'
    });
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Closed Signup Match',
        status: 'published',
        signupDeadlineAt: '2000-01-01T10:00:00.000Z',
        endAt: '2999-01-01T10:00:00.000Z'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        isOrganizer: true
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(getActivitySignupState).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'activity_123',
        signupDeadlineAt: '2000-01-01T10:00:00.000Z'
      }),
      undefined,
      expect.any(Function)
    );
    expect(ctx.data.activitySignupClosedVisible).toBe(true);
  });

  test('activity detail template renders a cancelled activity status badge', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain("activity.status === 'cancelled'");
    expect(wxml).toContain('class="hero-status cancelled-banner"');
    expect(wxml).toContain('{{i18n.activity.status.cancelled}}');
    expect(wxss).toContain('.cancelled-banner');
  });

  test('activity detail template renders a signup closed status badge', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain('wx:elif="{{activitySignupClosedVisible}}"');
    expect(wxml).toContain('class="hero-status signup-closed-banner"');
    expect(wxml).toContain('{{i18n.activity.status.signupClosed}}');
    expect(wxss).toContain('.signup-closed-banner');
  });

  test('reload passes registration management permission into the team list view model', async () => {
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Thursday Match',
        status: 'published'
      },
      teams: [
        {
          _id: 'team_white',
          teamName: 'White',
          joinedCount: 1,
          maxMembers: 6,
          members: []
        }
      ],
      myRegistration: null,
      viewer: {
        canCancelSignup: true,
        canEditActivity: true,
        canManageRegistrations: true
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(buildTeamListVm).toHaveBeenCalledWith(
      expect.any(Array),
      null,
      expect.objectContaining({ _id: 'activity_123' }),
      undefined,
      expect.any(Function),
      expect.objectContaining({
        canEditTeamColor: true,
        canManageRegistrations: true,
        canCancelSignup: true
      })
    );
    expect(ctx.data.viewer.canManageRegistrations).toBe(true);
  });

  test('activity detail template routes attendance changes through participant dialog', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxss'),
      'utf8'
    );

    expect(wxml).not.toContain('bind:attendancechange="onAttendanceChange"');
    expect(wxml).toContain('wx:if="{{participantDialogAttendanceVisible}}"');
    expect(wxml).toContain('data-status="present"');
    expect(wxml).toContain('data-status="absent"');
    expect(wxml).toContain('bindtap="onParticipantAttendanceChange"');
    expect(wxss).toContain('.participant-dialog-attendance');
    expect(wxss).toContain('.participant-dialog-attendance-seg');
  });

  test('activity detail template opens a participant dialog from team list member taps', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain('bind:membertap="onMemberTap"');
    expect(wxml).not.toContain('bind:manageraliasedit="onManagerAliasEdit"');
    expect(wxml).toContain('wx:if="{{participantDialogVisible}}"');
    expect(wxml).toContain('participantDialogMember.avatarUrl');
    expect(wxml).toContain('participantDialogMember.signupName');
    expect(wxml).toContain('wx:if="{{participantDialogAliasEditable}}"');
    expect(wxml).toContain('value="{{participantDialogAlias}}"');
    expect(wxml).toContain('maxlength="40"');
    expect(wxml).toContain('bindinput="onParticipantAliasInput"');
    expect(wxml).toContain('bindtap="onParticipantAliasSave"');
    expect(wxss).toContain('.participant-dialog-panel');
  });

  test('onParticipantAttendanceChange only changes the pending dialog status', async () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        participantDialogRegistrationId: 'registration_1',
        participantDialogAttendanceVisible: true,
        participantDialogAttendanceStatus: 'present',
        participantDialogOriginalAttendanceStatus: 'present',
        participantDialogAttendanceSaving: false
      },
      reload: jest.fn().mockResolvedValue(),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onParticipantAttendanceChange.call(ctx, {
      currentTarget: { dataset: { status: 'absent' } }
    });

    expect(ctx.data.participantDialogAttendanceStatus).toBe('absent');
    expect(setRegistrationAttendance).not.toHaveBeenCalled();
    expect(global.wx.showToast).not.toHaveBeenCalled();
    expect(ctx.reload).not.toHaveBeenCalled();
  });

  test('onMemberTap opens an info-only participant dialog for regular users', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    pageConfig.onMemberTap.call(ctx, {
      detail: {
        userOpenId: 'openid_player',
        signupName: 'Alex',
        avatarUrl: 'https://example.com/avatar.jpg',
        avatarText: 'A',
        managerAlias: 'Hidden Alias',
        managerAliasEditable: false,
        registrationId: 'registration_1',
        attendanceStatus: 'present',
        attendanceStatusText: 'Present',
        attendanceActionVisible: false,
        attendanceActionStatus: '',
        attendanceActionText: ''
      }
    });

    expect(ctx.data.participantDialogVisible).toBe(true);
    expect(ctx.data.participantDialogMember).toMatchObject({
      userOpenId: 'openid_player',
      signupName: 'Alex',
      avatarUrl: 'https://example.com/avatar.jpg',
      avatarText: 'A'
    });
    expect(ctx.data.participantDialogAliasEditable).toBe(false);
    expect(ctx.data.participantDialogAlias).toBe('');
    expect(ctx.data.participantDialogAttendanceVisible).toBe(false);
    expect(ctx.data.participantDialogRegistrationId).toBe('');
    expect(ctx.data.participantDialogAttendanceActionStatus).toBe('');
  });

  test('onMemberTap lets managers set attendance for proxy members without alias editing', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    pageConfig.onMemberTap.call(ctx, {
      detail: {
        userOpenId: '',
        signupName: '队员2',
        avatarText: '队',
        proxyRegistration: true,
        managerAlias: '',
        managerAliasEditable: false,
        registrationId: 'registration_proxy_1',
        attendanceStatus: 'present',
        attendanceStatusText: 'Present',
        attendanceActionVisible: true,
        attendanceActionStatus: 'absent',
        attendanceActionText: 'Mark absent'
      }
    });

    expect(ctx.data.participantDialogVisible).toBe(true);
    expect(ctx.data.participantDialogAliasEditable).toBe(false);
    expect(ctx.data.participantDialogAttendanceVisible).toBe(true);
    expect(ctx.data.participantDialogRegistrationId).toBe('registration_proxy_1');
    expect(ctx.data.participantDialogAttendanceStatus).toBe('present');
    expect(ctx.data.participantDialogAttendanceActionStatus).toBe('absent');
  });

  test('onMemberTap opens an editable participant alias dialog for managers', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    pageConfig.onMemberTap.call(ctx, {
      detail: {
        userOpenId: 'openid_player',
        signupName: 'Alex',
        avatarUrl: '',
        avatarText: 'A',
        managerAlias: 'Old Alias',
        managerAliasEditable: true,
        registrationId: 'registration_1',
        attendanceStatus: 'present',
        attendanceStatusText: 'Present',
        attendanceActionVisible: true,
        attendanceActionStatus: 'absent',
        attendanceActionText: 'Mark absent'
      }
    });

    expect(ctx.data.participantDialogVisible).toBe(true);
    expect(ctx.data.participantDialogMember).toMatchObject({
      userOpenId: 'openid_player',
      signupName: 'Alex',
      avatarText: 'A'
    });
    expect(ctx.data.participantDialogAliasEditable).toBe(true);
    expect(ctx.data.participantDialogAlias).toBe('Old Alias');
    expect(ctx.data.participantDialogAttendanceVisible).toBe(true);
    expect(ctx.data.participantDialogRegistrationId).toBe('registration_1');
    expect(ctx.data.participantDialogAttendanceStatus).toBe('present');
    expect(ctx.data.participantDialogAttendanceStatusText).toBe('Present');
    expect(ctx.data.participantDialogAttendanceActionStatus).toBe('absent');
    expect(ctx.data.participantDialogAttendanceActionText).toBe('Mark absent');
  });

  test('onParticipantAliasSave applies changed alias and attendance status together', async () => {
    updateParticipantManagerAlias.mockResolvedValue({
      user: {
        _id: 'openid_player',
        managerAlias: 'Zhang San'
      }
    });
    setRegistrationAttendance.mockResolvedValue({
      registration: {
        _id: 'registration_1',
        attendanceStatus: 'absent'
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        participantDialogAliasEditable: true,
        participantDialogAlias: '  Zhang San  ',
        participantDialogOriginalAlias: 'Old Alias',
        participantDialogRegistrationId: 'registration_1',
        participantDialogAttendanceVisible: true,
        participantDialogAttendanceStatus: 'absent',
        participantDialogOriginalAttendanceStatus: 'present',
        participantDialogMember: {
          userOpenId: 'openid_player',
          signupName: 'Alex'
        }
      },
      reload: jest.fn().mockResolvedValue(),
      closeParticipantDialog: pageConfig.closeParticipantDialog,
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onParticipantAliasSave.call(ctx);

    expect(updateParticipantManagerAlias).toHaveBeenCalledWith(
      'activity_123',
      'openid_player',
      'Zhang San'
    );
    expect(setRegistrationAttendance).toHaveBeenCalledWith(
      'activity_123',
      'registration_1',
      'absent'
    );
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Saved',
      icon: 'success'
    });
    expect(ctx.data.participantDialogVisible).toBe(false);
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('onParticipantAliasSave ignores info-only participant dialogs', async () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        participantDialogAliasEditable: false,
        participantDialogAlias: 'Ignored',
        participantDialogMember: {
          userOpenId: 'openid_player',
          signupName: 'Alex'
        }
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onParticipantAliasSave.call(ctx);

    expect(updateParticipantManagerAlias).not.toHaveBeenCalled();
    expect(ctx.reload).not.toHaveBeenCalled();
  });

  test('reload lets managers resubscribe when the saved manager notice template is stale', async () => {
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Thursday Match',
        status: 'published'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        canManageRegistrations: true,
        registrationNotificationSubscribed: true,
        registrationNotificationSubscriptionTemplateId: 'tmpl_activity_notice'
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(getManagerRegistrationNoticeTemplateId).toHaveBeenCalled();
    expect(ctx.data.viewer.registrationNotificationSubscribed).toBe(false);
    expect(ctx.data.viewer.registrationNotificationSubscriptionTemplateId).toBe(
      'tmpl_activity_notice'
    );
  });

  test('reload hides the map preview when the activity has no coordinates', async () => {
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Thursday Match',
        addressText: '123 Field Road',
        location: null,
        status: 'published'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        isOrganizer: true
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(ctx.data.locationMapVisible).toBe(false);
    expect(ctx.data.locationMapMarkers).toEqual([]);
  });

  test('reload trims activity description for detail display', async () => {
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Thursday Match',
        description: '  Bring both kits and arrive 15 minutes early.  ',
        status: 'published'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        isOrganizer: true
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(ctx.data.activityDescriptionText).toBe('Bring both kits and arrive 15 minutes early.');
  });

  test('reload exposes resolved detail gallery images for rendering', async () => {
    resolveActivityCoverImage.mockImplementation(activity =>
      Promise.resolve({
        ...activity,
        detailDisplayImages: [
          'https://tmp.example.com/detail-1.jpg',
          'https://tmp.example.com/detail-2.jpg'
        ]
      })
    );
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Thursday Match',
        detailImages: [
          'cloud://prod-env-123/activity-detail-images/detail-1.jpg',
          'cloud://prod-env-123/activity-detail-images/detail-2.jpg'
        ],
        status: 'published'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        isOrganizer: true
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(ctx.data.activityDetailImages).toEqual([
      'https://tmp.example.com/detail-1.jpg',
      'https://tmp.example.com/detail-2.jpg'
    ]);
  });

  test('activity detail template renders the activity description card', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{activityDescriptionText}}"');
    expect(wxml).toContain('{{i18n.activity.descriptionTitle}}');
    expect(wxml).toContain('{{activityDescriptionText}}');
  });

  test('activity detail template renders detail gallery images', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{activityDetailImages.length}}"');
    expect(wxml).toContain('wx:for="{{activityDetailImages}}"');
    expect(wxml).toContain('src="{{item}}"');
    expect(wxml).toContain('bindtap="onPreviewDetailImage"');
  });

  test('activity detail template renders the activity time in the hero', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{activityTimeText}}"');
    expect(wxml).toContain('class="hero-info-icon hero-info-icon-time"');
    expect(wxml).toContain('{{activityTimeText}}');
    expect(wxss).toContain('.activity-time-row');
    expect(wxss).toContain('.hero-info-icon-time');
  });

  test('reload exposes an activity time range for detail display', async () => {
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Wednesday Match',
        startAt: '2026-05-13T12:00:00.000Z',
        endAt: '2026-05-13T14:00:00.000Z',
        status: 'published'
      },
      teams: [],
      myRegistration: null,
      viewer: {
        isOrganizer: true
      }
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.reload.call(ctx);

    expect(formatDateTime).toHaveBeenCalledWith('2026-05-13T12:00:00.000Z');
    expect(formatDateTime).toHaveBeenCalledWith('2026-05-13T14:00:00.000Z');
    expect(ctx.data.activityTimeText).toBe('2026-05-13 20:00-22:00');
  });

  test('renders share and signup sections before description and detail images', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    const shareIndex = wxml.indexOf('class="share-card');
    const teamListIndex = wxml.indexOf('<team-list');
    const descriptionIndex = wxml.indexOf('class="description-card"');
    const detailImagesIndex = wxml.indexOf('class="detail-images-card"');

    expect(shareIndex).toBeGreaterThan(-1);
    expect(teamListIndex).toBeGreaterThan(shareIndex);
    expect(descriptionIndex).toBeGreaterThan(teamListIndex);
    expect(detailImagesIndex).toBeGreaterThan(descriptionIndex);
  });

  test('detail gallery images render without rounded corners', () => {
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxss'),
      'utf8'
    );
    const detailImageRule = wxss.match(/\.detail-image\s*{[^}]*}/);

    expect(detailImageRule).not.toBeNull();
    expect(detailImageRule[0]).not.toContain('border-radius');
  });

  test('onPreviewActivityCover previews the currently displayed cover image', () => {
    const ctx = {
      data: {
        activityCoverImage: 'https://tmp.example.com/cover.jpg'
      }
    };

    pageConfig.onPreviewActivityCover.call(ctx);

    expect(global.wx.previewImage).toHaveBeenCalledWith({
      current: 'https://tmp.example.com/cover.jpg',
      urls: ['https://tmp.example.com/cover.jpg']
    });
  });

  test('onConfirmActivityProceeding confirms the activity, notifies subscribers, and reloads detail', async () => {
    global.wx.showModal.mockImplementation(({ success }) => {
      success({ confirm: true });
    });
    notifyActivityParticipants.mockResolvedValue({
      sent: 1,
      failed: 0
    });
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onConfirmActivityProceeding.call(ctx);

    expect(global.wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Confirm Activity',
        content: 'Mark this activity as confirmed and notify subscribed participants?'
      })
    );
    expect(notifyActivityParticipants).toHaveBeenCalledWith('activity_123', 'proceeding');
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Activity confirmed',
      icon: 'success'
    });
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('activity detail template renders manager subscription action', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('bindtap="onSubscribeRegistrationNotifications"');
    expect(wxml).toContain('i18n.activity.actions.subscribeRegistrationNotifications');
    expect(wxml).toContain('disabled="{{viewer.registrationNotificationSubscribed}}"');
    expect(wxml).toContain('action-button-disabled');
    expect(wxml).toContain('i18n.activity.actions.registrationNotificationsSubscribed');
  });

  test('onSubscribeRegistrationNotifications records manager notification consent', async () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        viewer: {
          canManageRegistrations: true,
          registrationNotificationSubscribed: false
        }
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onSubscribeRegistrationNotifications.call(ctx);

    expect(requestManagerRegistrationNotificationSubscription).toHaveBeenCalledWith('activity_123');
    expect(requestActivityNotificationSubscription).not.toHaveBeenCalled();
    expect(ctx.data.viewer.registrationNotificationSubscribed).toBe(true);
    expect(ctx.data.viewer.registrationNotificationSubscriptionTemplateId).toBe(
      'tmpl_manager_current'
    );
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Signup notifications enabled',
      icon: 'success'
    });
  });

  test('onSubscribeRegistrationNotifications does not request consent again once subscribed', async () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        viewer: {
          canManageRegistrations: true,
          registrationNotificationSubscribed: true
        }
      }
    };

    await pageConfig.onSubscribeRegistrationNotifications.call(ctx);

    expect(requestManagerRegistrationNotificationSubscription).not.toHaveBeenCalled();
    expect(requestActivityNotificationSubscription).not.toHaveBeenCalled();
  });

  test('openEditActivity navigates to the create page in edit mode for the current activity', () => {
    const ctx = {
      data: {
        activityId: 'activity_123'
      }
    };

    global.wx.navigateTo = jest.fn();

    pageConfig.openEditActivity.call(ctx);

    expect(global.wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/activity-create/index?mode=edit&activityId=activity_123'
    });
  });

  test('activity detail template renders copy activity action only for activity managers', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{viewer.canEditActivity}}"');
    expect(wxml).toContain('bindtap="onCopyActivity"');
    expect(wxml).toContain('{{i18n.activity.actions.copyActivity}}');
  });

  test('onCopyActivity opens the create page in copy mode for the current activity', () => {
    const ctx = {
      data: {
        activityId: 'activity_123'
      }
    };

    global.wx.navigateTo = jest.fn();

    pageConfig.onCopyActivity.call(ctx);

    expect(global.wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/activity-create/index?mode=copy&activityId=activity_123'
    });
  });

  test('onCancelSignup does not cancel when the confirmation is dismissed', async () => {
    global.wx.showModal.mockImplementation(({ success }) => {
      success({ confirm: false });
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onCancelSignup.call(ctx);

    expect(global.wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cancel Signup',
        content: 'Leave this activity?'
      })
    );
    expect(cancelRegistration).not.toHaveBeenCalled();
    expect(ctx.reload).not.toHaveBeenCalled();
  });

  test('onCancelSignup confirms before cancelling signup and reloading detail', async () => {
    cancelRegistration.mockResolvedValue({
      status: 'cancelled'
    });
    global.wx.showModal.mockImplementation(({ success }) => {
      success({ confirm: true });
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onCancelSignup.call(ctx);

    expect(global.wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cancel Signup',
        content: 'Leave this activity?'
      })
    );
    expect(cancelRegistration).toHaveBeenCalledWith('activity_123');
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('onRemoveRegistration confirms removal, calls the service, and reloads detail', async () => {
    removeRegistration.mockResolvedValue({
      status: 'cancelled'
    });
    global.wx.showModal.mockImplementation(({ success }) => {
      success({ confirm: true });
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onRemoveRegistration.call(ctx, {
      detail: {
        userOpenId: 'openid_player',
        signupName: 'Alex'
      }
    });

    expect(global.wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Remove member',
        content: 'Remove Alex from this activity?'
      })
    );
    expect(removeRegistration).toHaveBeenCalledWith('activity_123', 'openid_player');
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('renders proxy signup form with optional preferred positions', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-detail/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-detail/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{proxySignupVisible}}"');
    expect(wxml).toContain('value="{{proxySignupName}}"');
    expect(wxml).toContain('wx:for="{{proxySignupPositionOptions}}"');
    expect(wxml).toContain('bindtap="onProxySignupPositionTap"');
    expect(wxml).toContain('bindtap="onProxySignupSubmit"');
    expect(wxml).toContain('{{i18n.modal.proxySignup.cancel}}');
    expect(wxss).toContain('.proxy-signup-panel');
    expect(wxss).toContain('.proxy-position-option-selected');
  });

  test('onProxySignup opens the proxy signup form for the selected team', () => {
    const ctx = {
      data: {
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    pageConfig.onProxySignup.call(ctx, {
      detail: {
        teamId: 'team_white',
        teamName: 'White'
      }
    });

    expect(ctx.data).toMatchObject({
      proxySignupVisible: true,
      proxySignupTeamId: 'team_white',
      proxySignupTeamName: 'White',
      proxySignupName: '',
      proxySignupPreferredPositions: []
    });
    expect(ctx.data.proxySignupPositionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: '\u524d\u950b',
          selected: false
        })
      ])
    );
  });

  test('onProxySignupPositionTap lets managers select up to two optional positions', () => {
    const ctx = {
      data: {
        locale: 'zh-CN',
        proxySignupPreferredPositions: [],
        proxySignupPositionOptions: []
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    pageConfig.onProxySignupPositionTap.call(ctx, {
      currentTarget: {
        dataset: {
          value: '\u524d\u950b'
        }
      }
    });
    pageConfig.onProxySignupPositionTap.call(ctx, {
      currentTarget: {
        dataset: {
          value: '\u95e8\u5c06'
        }
      }
    });
    pageConfig.onProxySignupPositionTap.call(ctx, {
      currentTarget: {
        dataset: {
          value: '\u4e2d\u573a'
        }
      }
    });

    expect(ctx.data.proxySignupPreferredPositions).toEqual(['\u524d\u950b', '\u95e8\u5c06']);
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '\u6700\u591a\u9009 2 \u4e2a\u4f4d\u7f6e',
      icon: 'none'
    });

    pageConfig.onProxySignupPositionTap.call(ctx, {
      currentTarget: {
        dataset: {
          value: '\u524d\u950b'
        }
      }
    });

    expect(ctx.data.proxySignupPreferredPositions).toEqual(['\u95e8\u5c06']);
  });

  test('onProxySignupSubmit adds the participant with selected positions and reloads detail', async () => {
    addProxyRegistration.mockResolvedValue({
      status: 'joined'
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        proxySignupVisible: true,
        proxySignupTeamId: 'team_white',
        proxySignupName: ' Guest Player ',
        proxySignupPreferredPositions: ['\u524d\u950b', '\u95e8\u5c06']
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      closeProxySignup: pageConfig.closeProxySignup,
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onProxySignupSubmit.call(ctx);

    expect(addProxyRegistration).toHaveBeenCalledWith(
      'activity_123',
      'team_white',
      'Guest Player',
      ['\u524d\u950b', '\u95e8\u5c06']
    );
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Participant added',
      icon: 'success'
    });
    expect(ctx.data.proxySignupVisible).toBe(false);
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('onProxySignupSubmit requires a participant name', async () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        proxySignupVisible: true,
        proxySignupTeamId: 'team_white',
        proxySignupName: '   ',
        proxySignupPreferredPositions: ['\u524d\u950b']
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onProxySignupSubmit.call(ctx);

    expect(addProxyRegistration).not.toHaveBeenCalled();
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Signup name is required',
      icon: 'none'
    });
    expect(ctx.reload).not.toHaveBeenCalled();
  });

  test('onMoveRegistration lets managers choose a target team and reloads detail', async () => {
    moveRegistration.mockResolvedValue({
      moved: true
    });
    global.wx.showActionSheet = jest.fn(({ success }) => {
      success({ tapIndex: 0 });
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        teams: [
          {
            _id: 'team_white',
            teamName: 'White',
            joinedCount: 1,
            maxMembers: 6
          },
          {
            _id: 'team_red',
            teamName: 'Red',
            joinedCount: 1,
            maxMembers: 6
          },
          {
            _id: 'team_blue',
            teamName: 'Blue',
            joinedCount: 6,
            maxMembers: 6
          },
          {
            _id: 'team_bench',
            teamName: 'Bench',
            teamType: 'bench',
            joinedCount: 0,
            maxMembers: 2
          }
        ]
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onMoveRegistration.call(ctx, {
      detail: {
        userOpenId: 'openid_player',
        signupName: 'Alex',
        currentTeamId: 'team_white'
      }
    });

    expect(global.wx.showActionSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        itemList: ['Red (1 / 6)']
      })
    );
    expect(moveRegistration).toHaveBeenCalledWith(
      'activity_123',
      'openid_player',
      'team_red'
    );
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Participant moved',
      icon: 'success'
    });
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('onCopyParticipantNames copies all joined member names in team order', () => {
    global.wx.setClipboardData.mockImplementation(({ success }) => {
      success();
    });

    const ctx = {
      data: {
        locale: 'en-US',
        teams: [
          {
            teamName: 'White',
            members: [
              { signupName: 'Alex', managerAlias: '老张', preferredPositions: ['前锋', '门将'] },
              { signupName: '  Ben  ', managerAliasText: '小本' }
            ]
          },
          {
            teamName: 'Red',
            members: [
              { displayName: 'Chris', preferredPositionsText: '中场' },
              { signupName: '' }
            ]
          }
        ]
      }
    };

    pageConfig.onCopyParticipantNames.call(ctx);

    expect(global.wx.setClipboardData).toHaveBeenCalledWith({
      data: 'Alex 老张 (前锋 / 门将)\nBen 小本\nChris (中场)',
      success: expect.any(Function)
    });
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Participant names copied',
      icon: 'success'
    });
  });

  test('onCopyParticipantNames shows a hint when there are no joined members', () => {
    const ctx = {
      data: {
        locale: 'en-US',
        teams: [
          {
            teamName: 'White',
            members: []
          }
        ]
      }
    };

    pageConfig.onCopyParticipantNames.call(ctx);

    expect(global.wx.setClipboardData).not.toHaveBeenCalled();
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'No participants to copy',
      icon: 'none'
    });
  });

  test('onOpenInsuranceLink opens the activity insurance link in a web-view page', () => {
    const ctx = {
      data: {
        locale: 'en-US',
        activity: {
          insuranceLink: 'https://insurance.example.com/apply?activity=abc&team=white'
        }
      }
    };

    pageConfig.onOpenInsuranceLink.call(ctx);

    expect(global.wx.navigateTo).toHaveBeenCalledWith({
      url:
        '/pages/insurance-webview/index?url=' +
        encodeURIComponent('https://insurance.example.com/apply?activity=abc&team=white')
    });
    expect(global.wx.setClipboardData).not.toHaveBeenCalled();
  });

  test('onCancelActivity cancels the activity, sends cancellation notices, and reloads detail', async () => {
    cancelActivity.mockResolvedValue({
      status: 'cancelled'
    });
    notifyActivityParticipants.mockResolvedValue({
      sent: 1,
      failed: 0
    });
    global.wx.showModal.mockImplementation(({ success }) => {
      success({ confirm: true });
    });
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onCancelActivity.call(ctx);

    expect(global.wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cancel Activity',
        content: 'This will stop new signups and notify subscribed participants.'
      })
    );
    expect(cancelActivity).toHaveBeenCalledWith('activity_123');
    expect(notifyActivityParticipants).toHaveBeenCalledWith('activity_123', 'cancelled');
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('onCancelActivity does not send cancellation notices after activity start', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-05-13T13:00:00.000Z'));
    cancelActivity.mockResolvedValue({
      status: 'cancelled'
    });
    global.wx.showModal.mockImplementation(({ success }) => {
      success({ confirm: true });
    });
    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US',
        activity: {
          startAt: '2026-05-13T12:00:00.000Z'
        }
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onCancelActivity.call(ctx);

    expect(cancelActivity).toHaveBeenCalledWith('activity_123');
    expect(notifyActivityParticipants).not.toHaveBeenCalled();
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('onShareAppMessage shares the current activity detail page with activity time', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        activity: {
          title: 'Thursday Match',
          startAt: '2026-05-13T12:00:00.000Z',
          endAt: '2026-05-13T14:00:00.000Z',
          coverImage: 'cloud://cover-image'
        },
        locale: 'en'
      }
    };

    expect(pageConfig.onShareAppMessage.call(ctx)).toEqual({
      title: 'Thursday Match\n2026-05-13 20:00-22:00',
      imageUrl: 'cloud://cover-image',
      path: '/pages/activity-detail/index?activityId=activity_123'
    });
  });

  test('onShareAppMessage prefers the share display image over the cover image', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        activity: {
          title: 'Thursday Match',
          shareDisplayImage: 'https://tmp.example.com/share.jpg',
          coverDisplayImage: 'https://tmp.example.com/cover.jpg',
          coverImage: 'cloud://cover-image'
        },
        locale: 'en'
      }
    };

    expect(pageConfig.onShareAppMessage.call(ctx)).toEqual({
      title: 'Thursday Match',
      imageUrl: 'https://tmp.example.com/share.jpg',
      path: '/pages/activity-detail/index?activityId=activity_123'
    });
  });

  test('onShareTimeline shares the current activity id and time in the timeline query', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        activity: {
          title: 'Thursday Match',
          startAt: '2026-05-13T12:00:00.000Z',
          endAt: '2026-05-13T14:00:00.000Z',
          coverImage: 'cloud://cover-image'
        },
        locale: 'en'
      }
    };

    expect(pageConfig.onShareTimeline.call(ctx)).toEqual({
      title: 'Thursday Match\n2026-05-13 20:00-22:00',
      imageUrl: 'cloud://cover-image',
      query: 'activityId=activity_123'
    });
  });
});
