jest.mock('../../../miniprogram/services/user-service', () => ({
  ensureUserProfile: jest.fn()
}));

jest.mock('../../../miniprogram/services/activity-service', () => ({
  cancelActivity: jest.fn(),
  deleteActivity: jest.fn(),
  listActivities: jest.fn(),
  resolveActivityCoverImages: jest.fn(items => Promise.resolve(items))
}));

jest.mock('../../../miniprogram/utils/formatters', () => ({
  buildActivityCardVm: jest.fn(item => ({
    id: item._id,
    title: item.title,
    startAt: item.startAt,
    status: item.status
  }))
}));

jest.mock('../../../miniprogram/utils/i18n', () => ({
  buildLanguageOptions: jest.fn(() => []),
  getAppLocale: jest.fn(() => 'en-US'),
  getMessages: jest.fn(() => ({
    my: {
      filterLabel: 'Filter',
      languageLabel: 'Language',
      tabs: {
        created: 'Created',
        joined: 'Joined'
      },
      filters: {
        all: 'All',
        published: 'Active',
        cancelled: 'Cancelled',
        deleted: 'Deleted'
      },
      copyUserIdSuccess: 'User ID copied'
    }
  })),
  makeTranslator: jest.fn(() => key => key),
  setPageNavigationTitle: jest.fn(),
  translateErrorMessage: jest.fn(error => error.message)
}));

describe('my page profile marker', () => {
  let pageConfig;
  let ensureUserProfile;
  let listActivities;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      setClipboardData: jest.fn(),
      showToast: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/my/index');
    ({ ensureUserProfile } = require('../../../miniprogram/services/user-service'));
    ({ listActivities } = require('../../../miniprogram/services/activity-service'));
  });

  test('onShow exposes a copyable user id and readable role summary', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user', 'organizer']
      }
    });
    listActivities.mockResolvedValue({
      items: []
    });

    const ctx = {
      ...pageConfig,
      data: {
        ...pageConfig.data
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.userOpenId).toBe('openid_owner');
    expect(ctx.data.userRoleText).toBe('user, organizer');
  });

  test('onCopyUserId copies the current user id', () => {
    const ctx = {
      data: {
        i18n: {
          my: {
            copyUserIdSuccess: 'User ID copied'
          }
        },
        userOpenId: 'openid_owner'
      }
    };

    pageConfig.onCopyUserId.call(ctx);

    expect(global.wx.setClipboardData).toHaveBeenCalledWith({
      data: 'openid_owner',
      success: expect.any(Function)
    });
  });

  test('sorts created and joined activities by newest start time first', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user']
      }
    });
    listActivities.mockImplementation(({ scope }) => {
      if (scope === 'created') {
        return Promise.resolve({
          items: [
            {
              _id: 'created_old',
              title: 'Created Old',
              startAt: '2026-05-01T12:00:00.000Z',
              status: 'published'
            },
            {
              _id: 'created_new',
              title: 'Created New',
              startAt: '2026-05-03T12:00:00.000Z',
              status: 'published'
            }
          ]
        });
      }

      return Promise.resolve({
        items: [
          {
            _id: 'joined_old',
            title: 'Joined Old',
            startAt: '2026-05-02T12:00:00.000Z',
            status: 'published'
          },
          {
            _id: 'joined_new',
            title: 'Joined New',
            startAt: '2026-05-04T12:00:00.000Z',
            status: 'published'
          }
        ]
      });
    });

    const ctx = {
      ...pageConfig,
      data: {
        ...pageConfig.data
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.createdItems.map(item => item.id)).toEqual(['created_new', 'created_old']);
    expect(ctx.data.joinedItems.map(item => item.id)).toEqual(['joined_new', 'joined_old']);
  });
});
