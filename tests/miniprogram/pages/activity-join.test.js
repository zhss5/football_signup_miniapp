const fs = require('fs');
const path = require('path');

jest.mock('../../../miniprogram/services/registration-service', () => ({
  joinActivity: jest.fn(),
  resolvePhoneNumber: jest.fn()
}));

jest.mock('../../../miniprogram/services/cloud', () => ({
  uploadFile: jest.fn()
}));

describe('activity join page', () => {
  let pageConfig;
  let joinActivity;
  let resolvePhoneNumber;
  let uploadFile;
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
    ({ joinActivity, resolvePhoneNumber } = require('../../../miniprogram/services/registration-service'));
    ({ uploadFile } = require('../../../miniprogram/services/cloud'));
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
    uploadFile.mockResolvedValue('cloud://prod-env-123/user-avatars/alex.jpg');

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
      phone: '13800000000',
      phoneSource: 'wechat',
      authorizedPhone: '13800000000',
      avatarUrl: 'wxfile://tmp_avatar.jpg',
      avatarTempFilePath: 'wxfile://tmp_avatar.jpg',
      profileSource: 'wechat'
    });

    await pageConfig.onSubmit.call(ctx);

    expect(uploadFile).toHaveBeenCalledWith(
      'wxfile://tmp_avatar.jpg',
      expect.stringMatching(/^user-avatars\/\d+-[a-z0-9]+\.jpg$/)
    );
    expect(joinActivity).toHaveBeenCalledWith({
      activityId: 'activity_123',
      teamId: 'team_red',
      signupName: 'Alex',
      phone: '13800000000',
      phoneSource: 'wechat',
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      profileSource: 'wechat',
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

  test('renders WeChat profile and phone entry points on the signup page', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-join/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('open-type="chooseAvatar"');
    expect(wxml).toContain('type="nickname"');
    expect(wxml).toContain('open-type="getPhoneNumber"');
  });

  test('fills the phone field from WeChat phone authorization', async () => {
    resolvePhoneNumber.mockResolvedValue({
      phoneNumber: '13800000000',
      phoneSource: 'wechat'
    });

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
      teamName: 'Red'
    });

    await pageConfig.onGetPhoneNumber.call(ctx, {
      detail: {
        errMsg: 'getPhoneNumber:ok',
        code: 'phone_code_123'
      }
    });

    expect(resolvePhoneNumber).toHaveBeenCalledWith('phone_code_123');
    expect(ctx.data.phone).toBe('13800000000');
    expect(ctx.data.authorizedPhone).toBe('13800000000');
    expect(ctx.data.phoneSource).toBe('wechat');
  });

  test('treats edited phone numbers as manual after WeChat authorization', () => {
    const ctx = {
      data: {
        authorizedPhone: '13800000000',
        phoneSource: 'wechat'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    pageConfig.onPhoneInput.call(ctx, {
      detail: {
        value: '13900000000'
      }
    });

    expect(ctx.data.phone).toBe('13900000000');
    expect(ctx.data.phoneSource).toBe('manual');
  });

  test('requires a phone number even when the activity did not require phone before', async () => {
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
      requirePhone: '0'
    });

    ctx.setData({
      signupName: 'Alex',
      phone: ''
    });

    await pageConfig.onSubmit.call(ctx);

    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Phone is required',
      icon: 'none'
    });
    expect(joinActivity).not.toHaveBeenCalled();
  });
});
