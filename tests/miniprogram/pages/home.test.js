jest.mock('../../../miniprogram/services/user-service', () => ({
  ensureUserProfile: jest.fn()
}));

jest.mock('../../../miniprogram/services/activity-service', () => ({
  listActivities: jest.fn()
}));

jest.mock('../../../miniprogram/utils/formatters', () => ({
  buildActivityCardVm: jest.fn(item => ({
    id: item._id,
    title: item.title
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

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      navigateTo: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/home/index');
    ({ ensureUserProfile } = require('../../../miniprogram/services/user-service'));
    ({ listActivities } = require('../../../miniprogram/services/activity-service'));
  });

  test('loads activities without syncing the user profile on startup', async () => {
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
        loading: false
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await expect(pageConfig.onShow.call(ctx)).resolves.toBeUndefined();

    expect(ensureUserProfile).not.toHaveBeenCalled();
    expect(listActivities).toHaveBeenCalledWith({ scope: 'home', limit: 20 });
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.items).toEqual([
      {
        id: 'activity_123',
        title: 'Thursday Match'
      }
    ]);
  });
});
