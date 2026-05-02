const fs = require('fs');
const path = require('path');

jest.mock('../../../miniprogram/services/registration-service', () => ({
  joinActivity: jest.fn()
}));

jest.mock('../../../miniprogram/services/cloud', () => ({
  uploadFile: jest.fn()
}));

jest.mock('../../../miniprogram/services/user-service', () => ({
  ensureUserProfile: jest.fn()
}));

jest.mock('../../../miniprogram/services/notification-service', () => ({
  recordActivityNotificationSubscription: jest.fn(),
  requestActivityNotificationSubscriptionConsent: jest.fn()
}));

describe('activity join page', () => {
  let pageConfig;
  let joinActivity;
  let uploadFile;
  let ensureUserProfile;
  let recordActivityNotificationSubscription;
  let requestActivityNotificationSubscriptionConsent;
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
    ({ uploadFile } = require('../../../miniprogram/services/cloud'));
    ({ ensureUserProfile } = require('../../../miniprogram/services/user-service'));
    ({
      recordActivityNotificationSubscription,
      requestActivityNotificationSubscriptionConsent
    } = require('../../../miniprogram/services/notification-service'));
    ensureUserProfile.mockResolvedValue({ user: {} });
    requestActivityNotificationSubscriptionConsent.mockResolvedValue({
      configured: true,
      templateId: 'tmpl_123',
      status: 'accepted'
    });
    recordActivityNotificationSubscription.mockResolvedValue({
      ok: true
    });
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
      teamName: 'Red'
    });

    ctx.setData({
      signupName: 'Alex',
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
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      profileSource: 'wechat',
      source: 'share'
    });
    expect(requestActivityNotificationSubscriptionConsent).toHaveBeenCalled();
    expect(
      requestActivityNotificationSubscriptionConsent.mock.invocationCallOrder[0]
    ).toBeLessThan(joinActivity.mock.invocationCallOrder[0]);
    expect(recordActivityNotificationSubscription).toHaveBeenCalledWith(
      'activity_123',
      expect.objectContaining({
        configured: true,
        templateId: 'tmpl_123',
        status: 'accepted'
      })
    );
    expect(
      recordActivityNotificationSubscription.mock.invocationCallOrder[0]
    ).toBeGreaterThan(joinActivity.mock.invocationCallOrder[0]);
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

  test('keeps signup successful when notification subscription request fails', async () => {
    joinActivity.mockResolvedValue({ status: 'joined' });
    requestActivityNotificationSubscriptionConsent.mockRejectedValue(new Error('subscribe failed'));

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
    ctx.setData({
      signupName: 'Alex'
    });

    await pageConfig.onSubmit.call(ctx);

    expect(joinActivity).toHaveBeenCalled();
    expect(recordActivityNotificationSubscription).not.toHaveBeenCalled();
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Signup successful',
      icon: 'success'
    });
  });

  test('prefills signup name and avatar from the saved user profile', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        preferredName: 'Saved Alex',
        avatarUrl: 'cloud://prod-env-123/user-avatars/saved-alex.jpg',
        profileSource: 'wechat'
      }
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

    await pageConfig.onLoad.call(ctx, {
      activityId: 'activity_123',
      teamId: 'team_red',
      teamName: 'Red'
    });

    expect(ensureUserProfile).toHaveBeenCalled();
    expect(ctx.data.signupName).toBe('Saved Alex');
    expect(ctx.data.avatarUrl).toBe('cloud://prod-env-123/user-avatars/saved-alex.jpg');
    expect(ctx.data.avatarTempFilePath).toBe('');
    expect(ctx.data.profileSource).toBe('wechat');
  });

  test('does not overwrite manually entered profile fields when profile loading finishes later', async () => {
    let resolveProfile;
    ensureUserProfile.mockReturnValue(
      new Promise(resolve => {
        resolveProfile = resolve;
      })
    );

    const ctx = {
      data: {},
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    const loadPromise = pageConfig.onLoad.call(ctx, {
      activityId: 'activity_123',
      teamId: 'team_red',
      teamName: 'Red'
    });

    pageConfig.onNameInput.call(ctx, {
      detail: {
        value: 'Manual Alex'
      }
    });
    pageConfig.onChooseAvatar.call(ctx, {
      detail: {
        avatarUrl: 'wxfile://manual-avatar.jpg'
      }
    });

    resolveProfile({
      user: {
        preferredName: 'Saved Alex',
        avatarUrl: 'cloud://prod-env-123/user-avatars/saved-alex.jpg',
        profileSource: 'wechat'
      }
    });
    await loadPromise;

    expect(ctx.data.signupName).toBe('Manual Alex');
    expect(ctx.data.avatarUrl).toBe('wxfile://manual-avatar.jpg');
    expect(ctx.data.avatarTempFilePath).toBe('wxfile://manual-avatar.jpg');
    expect(ctx.data.profileSource).toBe('wechat');
  });

  test('renders WeChat profile entry points without any phone collection UI', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-join/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('open-type="chooseAvatar"');
    expect(wxml).toContain('type="nickname"');
    expect(wxml).not.toContain('open-type="getPhoneNumber"');
    expect(wxml).not.toContain('bindgetphonenumber');
    expect(wxml).not.toContain('phonePlaceholder');
    expect(pageConfig.onGetPhoneNumber).toBeUndefined();
    expect(pageConfig.onPhoneInput).toBeUndefined();
  });

  test('requires only a signup name before submitting', async () => {
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

    ctx.setData({
      signupName: ''
    });

    await pageConfig.onSubmit.call(ctx);

    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Signup name is required',
      icon: 'none'
    });
    expect(joinActivity).not.toHaveBeenCalled();
  });
});
