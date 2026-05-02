jest.mock('../../../miniprogram/services/user-service', () => ({
  ensureUserProfile: jest.fn()
}));

jest.mock('../../../miniprogram/services/activity-service', () => ({
  listActivities: jest.fn(),
  resolveActivityCoverImages: jest.fn(items => Promise.resolve(items))
}));

jest.mock('../../../miniprogram/utils/formatters', () => ({
  buildActivityCardVm: jest.fn(item => ({
    id: item._id,
    title: item.title,
    createdAt: item.createdAt,
    statusTone: item.statusTone || 'joinable'
  }))
}));

jest.mock('../../../miniprogram/utils/i18n', () => ({
  getAppLocale: jest.fn(() => 'en-US'),
  getMessages: jest.fn(() => ({ home: { createActivity: 'Create Activity' } })),
  makeTranslator: jest.fn(() => key => key),
  setPageNavigationTitle: jest.fn()
}));

describe('home page', () => {
  let pageConfig;
  let ensureUserProfile;
  let listActivities;
  let resolveActivityCoverImages;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      navigateTo: jest.fn(),
      showToast: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/home/index');
    ({ ensureUserProfile } = require('../../../miniprogram/services/user-service'));
    ({ listActivities, resolveActivityCoverImages } = require('../../../miniprogram/services/activity-service'));
  });

  test('loads activities while refreshing create permission from the user profile', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        roles: ['user', 'organizer']
      }
    });
    listActivities.mockResolvedValue({
      items: [
        {
          _id: 'activity_123',
          title: 'Thursday Match'
        }
      ]
    });

    const ctx = {
      ...pageConfig,
      data: {
        items: [],
        loading: false,
        canCreateActivity: false
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await expect(pageConfig.onShow.call(ctx)).resolves.toBeUndefined();

    expect(ensureUserProfile).toHaveBeenCalled();
    expect(listActivities).toHaveBeenCalledWith({ scope: 'home', limit: 20 });
    expect(resolveActivityCoverImages).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'activity_123',
        title: 'Thursday Match',
        statusTone: 'joinable'
      })
    ]);
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.canCreateActivity).toBe(true);
    expect(ctx.data.items).toEqual([
      {
        id: 'activity_123',
        title: 'Thursday Match',
        createdAt: undefined,
        statusTone: 'joinable'
      }
    ]);
  });

  test('handles activity list timeout without rejecting the page lifecycle', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        roles: ['user']
      }
    });
    listActivities.mockRejectedValue(new Error('timeout'));

    const ctx = {
      ...pageConfig,
      data: {
        items: [],
        loading: false,
        canCreateActivity: false
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await expect(pageConfig.onShow.call(ctx)).resolves.toBeUndefined();

    expect(listActivities).toHaveBeenCalledWith({ scope: 'home', limit: 20 });
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.items).toEqual([]);
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'toast.loadActivitiesFailed',
      icon: 'none'
    });
  });

  test('shows only joinable activities sorted by newest creation time first', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        roles: ['user']
      }
    });
    listActivities.mockResolvedValue({
      items: [
        {
          _id: 'old_joinable',
          title: 'Old Joinable',
          statusTone: 'joinable',
          createdAt: '2026-04-28T10:00:00.000Z'
        },
        {
          _id: 'new_closed',
          title: 'New Closed',
          statusTone: 'disabled',
          createdAt: '2026-05-02T12:00:00.000Z'
        },
        {
          _id: 'new_joinable',
          title: 'New Joinable',
          statusTone: 'joinable',
          createdAt: '2026-05-01T12:00:00.000Z'
        }
      ]
    });

    const ctx = {
      ...pageConfig,
      data: {
        items: [],
        loading: false,
        canCreateActivity: false
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.items.map(item => item.id)).toEqual(['new_joinable', 'old_joinable']);
  });

  test('keeps the home page usable when create permission refresh fails', async () => {
    ensureUserProfile.mockRejectedValue(new Error('timeout'));
    listActivities.mockResolvedValue({
      items: []
    });

    const ctx = {
      ...pageConfig,
      data: {
        items: [],
        loading: false,
        canCreateActivity: true
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await expect(pageConfig.onShow.call(ctx)).resolves.toBeUndefined();

    expect(listActivities).toHaveBeenCalledWith({ scope: 'home', limit: 20 });
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.canCreateActivity).toBe(false);
  });
});
