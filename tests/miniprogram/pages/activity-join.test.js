const fs = require('fs');
const path = require('path');

jest.mock('../../../miniprogram/services/registration-service', () => ({
  joinActivity: jest.fn()
}));

describe('activity join page', () => {
  let pageConfig;
  let joinActivity;
  let openerEventChannel;

  beforeEach(() => {
    jest.useFakeTimers();
    pageConfig = null;
    openerEventChannel = {
      emit: jest.fn()
    };

    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      getOpenerEventChannel: jest.fn(() => openerEventChannel),
      navigateBack: jest.fn(),
      setNavigationBarTitle: jest.fn(),
      showToast: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/activity-join/index');
    ({ joinActivity } = require('../../../miniprogram/services/registration-service'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('registers the dedicated join page in the mini program', () => {
    const appJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../../miniprogram/app.json'), 'utf8')
    );

    expect(appJson.pages).toContain('pages/activity-join/index');
  });

  test('submits signup, shows success feedback, and returns to detail', async () => {
    joinActivity.mockResolvedValue({ status: 'joined' });

    const ctx = {
      data: {},
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    pageConfig.onLoad.call(ctx, {
      activityId: 'activity_123',
      teamId: 'team_red',
      teamName: 'Red',
      requirePhone: '1'
    });

    ctx.setData({
      signupName: 'Alex',
      phone: '13800000000'
    });

    await pageConfig.onSubmit.call(ctx);

    expect(joinActivity).toHaveBeenCalledWith({
      activityId: 'activity_123',
      teamId: 'team_red',
      signupName: 'Alex',
      phone: '13800000000',
      source: 'share'
    });
    expect(openerEventChannel.emit).toHaveBeenCalledWith('signupSuccess');
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Signup successful',
      icon: 'success'
    });

    jest.runAllTimers();

    expect(global.wx.navigateBack).toHaveBeenCalledWith({
      delta: 1
    });
  });
});
