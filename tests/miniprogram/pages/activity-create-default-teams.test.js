jest.mock('../../../miniprogram/services/activity-service', () => ({
  createActivity: jest.fn(),
  getActivityDetail: jest.fn(),
  updateActivity: jest.fn()
}));

jest.mock('../../../miniprogram/services/cloud', () => ({
  uploadFile: jest.fn()
}));

jest.mock('../../../miniprogram/services/user-service', () => ({
  ensureUserProfile: jest.fn()
}));

describe('activity create default teams', () => {
  let pageConfig;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        locale: 'en-US'
      }
    }));
    global.wx = {
      setNavigationBarTitle: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/activity-create/index');
  });

  test('new activities start with one editable team by default', () => {
    const ctx = {
      data: {
        ...pageConfig.data,
        isEditMode: false
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: pageConfig.syncDerivedState
    };

    pageConfig.applyI18n.call(ctx, true);

    expect(ctx.data.form.teams).toEqual([
      {
        teamName: 'White',
        maxMembers: 12
      }
    ]);
    expect(ctx.data.namedTeamSlots).toBe(12);
    expect(ctx.data.benchSlots).toBe(0);
  });
});
