jest.mock('../../../miniprogram/services/activity-service', () => ({
  getActivityDetail: jest.fn(),
  cancelActivity: jest.fn()
}));

jest.mock('../../../miniprogram/services/registration-service', () => ({
  cancelRegistration: jest.fn()
}));

jest.mock('../../../miniprogram/utils/formatters', () => ({
  buildTeamListVm: jest.fn((teams) => teams)
}));

describe('activity detail page', () => {
  let pageConfig;
  let getActivityDetail;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      showToast: jest.fn(),
      showShareMenu: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/activity-detail/index');
    ({ getActivityDetail } = require('../../../miniprogram/services/activity-service'));
  });

  test('openSignup stores the selected team name so the sheet can show which team is being joined', () => {
    const ctx = {
      data: {
        activityId: 'activity_123',
        activity: {
          requirePhone: true
        },
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
      url: '/pages/activity-join/index?activityId=activity_123&teamId=team_red&teamName=Red&requirePhone=1',
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

  test('onLoad keeps the post-publish share hint visible after redirecting from create activity', async () => {
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
    expect(global.wx.showShareMenu).toHaveBeenCalled();
  });
});
