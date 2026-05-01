jest.mock('../../../miniprogram/services/activity-service', () => ({
  getActivityDetail: jest.fn(),
  cancelActivity: jest.fn(),
  resolveActivityCoverImage: jest.fn(activity => Promise.resolve(activity))
}));

jest.mock('../../../miniprogram/services/registration-service', () => ({
  addProxyRegistration: jest.fn(),
  cancelRegistration: jest.fn(),
  moveRegistration: jest.fn(),
  removeRegistration: jest.fn()
}));

jest.mock('../../../miniprogram/utils/formatters', () => ({
  buildTeamListVm: jest.fn((teams) => teams)
}));

describe('activity detail page', () => {
  let pageConfig;
  let getActivityDetail;
  let addProxyRegistration;
  let moveRegistration;
  let removeRegistration;
  let buildTeamListVm;
  let resolveActivityCoverImage;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      showToast: jest.fn(),
      showModal: jest.fn(),
      showShareMenu: jest.fn(),
      setClipboardData: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/activity-detail/index');
    ({ getActivityDetail } = require('../../../miniprogram/services/activity-service'));
    ({ resolveActivityCoverImage } = require('../../../miniprogram/services/activity-service'));
    ({ addProxyRegistration } = require('../../../miniprogram/services/registration-service'));
    ({ moveRegistration } = require('../../../miniprogram/services/registration-service'));
    ({ removeRegistration } = require('../../../miniprogram/services/registration-service'));
    ({ buildTeamListVm } = require('../../../miniprogram/utils/formatters'));
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
        canManageRegistrations: true,
        canCancelSignup: true
      })
    );
    expect(ctx.data.viewer.canManageRegistrations).toBe(true);
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

  test('onProxySignup prompts for a name, adds the participant, and reloads detail', async () => {
    addProxyRegistration.mockResolvedValue({
      status: 'joined'
    });
    global.wx.showModal.mockImplementation(({ success }) => {
      success({
        confirm: true,
        content: ' Guest Player '
      });
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onProxySignup.call(ctx, {
      detail: {
        teamId: 'team_white',
        teamName: 'White'
      }
    });

    expect(global.wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Add participant',
        editable: true,
        placeholderText: 'Participant name'
      })
    );
    expect(addProxyRegistration).toHaveBeenCalledWith(
      'activity_123',
      'team_white',
      'Guest Player'
    );
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Participant added',
      icon: 'success'
    });
    expect(ctx.reload).toHaveBeenCalled();
  });

  test('onProxySignup requires a participant name', async () => {
    global.wx.showModal.mockImplementation(({ success }) => {
      success({
        confirm: true,
        content: '   '
      });
    });

    const ctx = {
      data: {
        activityId: 'activity_123',
        locale: 'en-US'
      },
      reload: jest.fn().mockResolvedValue()
    };

    await pageConfig.onProxySignup.call(ctx, {
      detail: {
        teamId: 'team_white',
        teamName: 'White'
      }
    });

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
              { signupName: 'Alex' },
              { signupName: '  Ben  ' }
            ]
          },
          {
            teamName: 'Red',
            members: [
              { displayName: 'Chris' },
              { signupName: '' }
            ]
          }
        ]
      }
    };

    pageConfig.onCopyParticipantNames.call(ctx);

    expect(global.wx.setClipboardData).toHaveBeenCalledWith({
      data: 'Alex\nBen\nChris',
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

  test('onCopyInsuranceLink copies the activity insurance link', () => {
    global.wx.setClipboardData.mockImplementation(({ success }) => {
      success();
    });

    const ctx = {
      data: {
        locale: 'en-US',
        activity: {
          insuranceLink: 'https://insurance.example.com/apply'
        }
      }
    };

    pageConfig.onCopyInsuranceLink.call(ctx);

    expect(global.wx.setClipboardData).toHaveBeenCalledWith({
      data: 'https://insurance.example.com/apply',
      success: expect.any(Function)
    });
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Insurance link copied',
      icon: 'success'
    });
  });

  test('onShareAppMessage shares the current activity detail page', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        activity: {
          title: 'Thursday Match',
          coverImage: 'cloud://cover-image'
        },
        locale: 'en'
      }
    };

    expect(pageConfig.onShareAppMessage.call(ctx)).toEqual({
      title: 'Thursday Match',
      imageUrl: 'cloud://cover-image',
      path: '/pages/activity-detail/index?activityId=activity_123'
    });
  });

  test('onShareTimeline shares the current activity id in the timeline query', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        activity: {
          title: 'Thursday Match',
          coverImage: 'cloud://cover-image'
        },
        locale: 'en'
      }
    };

    expect(pageConfig.onShareTimeline.call(ctx)).toEqual({
      title: 'Thursday Match',
      imageUrl: 'cloud://cover-image',
      query: 'activityId=activity_123'
    });
  });
});
