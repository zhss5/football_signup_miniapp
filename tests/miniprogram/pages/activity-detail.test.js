jest.mock('../../../miniprogram/services/activity-service', () => ({
  getActivityDetail: jest.fn()
}));

jest.mock('../../../miniprogram/services/registration-service', () => ({
  joinActivity: jest.fn(),
  cancelRegistration: jest.fn()
}));

jest.mock('../../../miniprogram/utils/formatters', () => ({
  buildTeamListVm: jest.fn((teams) => teams)
}));

describe('activity detail page', () => {
  let pageConfig;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });

    jest.resetModules();
    require('../../../miniprogram/pages/activity-detail/index');
  });

  test('openSignup stores the selected team name so the sheet can show which team is being joined', () => {
    const ctx = {
      data: {
        teams: [
          { _id: 'team_white', teamName: 'White', joinDisabled: false },
          { _id: 'team_red', teamName: 'Red', joinDisabled: false }
        ]
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    pageConfig.openSignup.call(ctx, {
      detail: {
        teamId: 'team_red'
      }
    });

    expect(ctx.data.signupVisible).toBe(true);
    expect(ctx.data.pendingTeamId).toBe('team_red');
    expect(ctx.data.pendingTeamName).toBe('Red');
  });
});
