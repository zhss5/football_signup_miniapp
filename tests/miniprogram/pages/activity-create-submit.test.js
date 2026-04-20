jest.mock('../../../miniprogram/services/activity-service', () => ({
  createActivity: jest.fn()
}));

jest.mock('../../../miniprogram/utils/activity-draft', () => ({
  buildActivityPayload: jest.fn(form => form),
  createDefaultActivityForm: jest.fn(() => ({
    title: 'Thursday Match'
  })),
  summarizeTeamSlots: jest.fn(() => ({
    namedTeamSlots: 12,
    benchSlots: 0,
    overCapacity: false
  }))
}));

jest.mock('../../../miniprogram/utils/validators', () => ({
  validateActivityDraft: jest.fn()
}));

jest.mock('../../../miniprogram/utils/constants', () => ({
  MAX_ACTIVITY_IMAGES: 1,
  MAX_TEAMS: 4
}));

describe('activity create submit flow', () => {
  let pageConfig;
  let createActivity;
  let validateActivityDraft;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      redirectTo: jest.fn(),
      showToast: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/activity-create/index');
    ({ createActivity } = require('../../../miniprogram/services/activity-service'));
    ({ validateActivityDraft } = require('../../../miniprogram/utils/validators'));
  });

  test('onSubmit redirects to detail with the post-publish share flag', async () => {
    createActivity.mockResolvedValue({ activityId: 'activity_123' });

    const ctx = {
      data: {
        form: {
          title: 'Thursday Match'
        }
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: jest.fn()
    };

    await pageConfig.onSubmit.call(ctx);

    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/pages/activity-detail/index?activityId=activity_123&fromPublish=1'
    });
  });

  test('onSubmit highlights the location input when address validation fails', async () => {
    validateActivityDraft.mockImplementation(() => {
      throw new Error('Activity address is required');
    });

    const ctx = {
      data: {
        form: {
          title: 'Thursday Match'
        },
        validationErrors: {}
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: jest.fn()
    };

    await pageConfig.onSubmit.call(ctx);

    expect(ctx.data.validationErrors).toMatchObject({
      addressText: 'Activity address is required'
    });
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Activity address is required',
      icon: 'none'
    });
  });
});
