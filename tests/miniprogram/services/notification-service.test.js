jest.mock('../../../miniprogram/services/cloud', () => ({
  call: jest.fn()
}));

describe('notification service', () => {
  let call;

  beforeEach(() => {
    jest.resetModules();
    ({ call } = require('../../../miniprogram/services/cloud'));
    call.mockResolvedValue({ ok: true });
    global.wx = {
      requestSubscribeMessage: jest.fn(({ success }) => {
        success({
          tmpl_123: 'accept'
        });
      })
    };
  });

  test('requests the activity notice template and records accepted subscriptions', async () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        activityNotice: 'tmpl_123'
      }
    }));

    const { requestActivityNotificationSubscription } = require('../../../miniprogram/services/notification-service');

    await expect(requestActivityNotificationSubscription('activity_1')).resolves.toMatchObject({
      configured: true,
      status: 'accepted'
    });

    expect(global.wx.requestSubscribeMessage).toHaveBeenCalledWith({
      tmplIds: ['tmpl_123'],
      success: expect.any(Function),
      fail: expect.any(Function)
    });
    expect(call).toHaveBeenCalledWith('recordNotificationSubscription', {
      activityId: 'activity_1',
      templateKey: 'activity_notice',
      templateId: 'tmpl_123',
      status: 'accepted'
    });
  });

  test('requests the manager registration notice template and records accepted subscriptions', async () => {
    global.wx.requestSubscribeMessage = jest.fn(({ success }) => {
      success({
        tmpl_manager: 'accept'
      });
    });
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        activityNotice: 'tmpl_activity',
        managerRegistrationNotice: 'tmpl_manager'
      }
    }));

    const {
      requestManagerRegistrationNotificationSubscription
    } = require('../../../miniprogram/services/notification-service');

    await expect(
      requestManagerRegistrationNotificationSubscription('activity_1')
    ).resolves.toMatchObject({
      configured: true,
      templateKey: 'manager_registration_notice',
      status: 'accepted'
    });

    expect(global.wx.requestSubscribeMessage).toHaveBeenCalledWith({
      tmplIds: ['tmpl_manager'],
      success: expect.any(Function),
      fail: expect.any(Function)
    });
    expect(call).toHaveBeenCalledWith('recordNotificationSubscription', {
      activityId: 'activity_1',
      templateKey: 'manager_registration_notice',
      templateId: 'tmpl_manager',
      status: 'accepted'
    });
  });

  test('requests configured manager notice templates together and records each result separately', async () => {
    global.wx.requestSubscribeMessage = jest.fn(({ success }) => {
      success({
        tmpl_threshold: 'accept',
        tmpl_late_cancel: 'reject'
      });
    });
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        managerRegistrationNotice: 'tmpl_threshold',
        managerLateCancellationNotice: 'tmpl_late_cancel'
      }
    }));

    const {
      requestManagerNotificationSubscriptions
    } = require('../../../miniprogram/services/notification-service');

    await expect(
      requestManagerNotificationSubscriptions('activity_1')
    ).resolves.toEqual([
      {
        configured: true,
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_threshold',
        status: 'accepted'
      },
      {
        configured: true,
        templateKey: 'manager_late_cancellation_notice',
        templateId: 'tmpl_late_cancel',
        status: 'declined'
      }
    ]);

    expect(global.wx.requestSubscribeMessage).toHaveBeenCalledWith({
      tmplIds: ['tmpl_threshold', 'tmpl_late_cancel'],
      success: expect.any(Function),
      fail: expect.any(Function)
    });
    expect(call).toHaveBeenNthCalledWith(1, 'recordNotificationSubscription', {
      activityId: 'activity_1',
      templateKey: 'manager_registration_notice',
      templateId: 'tmpl_threshold',
      status: 'accepted'
    });
    expect(call).toHaveBeenNthCalledWith(2, 'recordNotificationSubscription', {
      activityId: 'activity_1',
      templateKey: 'manager_late_cancellation_notice',
      templateId: 'tmpl_late_cancel',
      status: 'declined'
    });
  });

  test('requests only selected missing manager notice templates', async () => {
    global.wx.requestSubscribeMessage = jest.fn(({ success }) => {
      success({
        tmpl_late_cancel: 'accept'
      });
    });
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        managerRegistrationNotice: 'tmpl_threshold',
        managerLateCancellationNotice: 'tmpl_late_cancel'
      }
    }));

    const {
      requestManagerNotificationSubscriptionsConsent
    } = require('../../../miniprogram/services/notification-service');

    await expect(
      requestManagerNotificationSubscriptionsConsent(['manager_late_cancellation_notice'])
    ).resolves.toEqual([
      {
        configured: true,
        templateKey: 'manager_late_cancellation_notice',
        templateId: 'tmpl_late_cancel',
        status: 'accepted'
      }
    ]);
    expect(global.wx.requestSubscribeMessage).toHaveBeenCalledWith({
      tmplIds: ['tmpl_late_cancel'],
      success: expect.any(Function),
      fail: expect.any(Function)
    });
    expect(call).not.toHaveBeenCalled();
  });

  test('returns no manager subscriptions when no manager template is configured', async () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {}
    }));

    const {
      requestManagerNotificationSubscriptionsConsent
    } = require('../../../miniprogram/services/notification-service');

    await expect(requestManagerNotificationSubscriptionsConsent()).resolves.toEqual([]);
    expect(global.wx.requestSubscribeMessage).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });

  test('can request subscription consent before recording it', async () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        activityNotice: 'tmpl_123'
      }
    }));

    const {
      requestActivityNotificationSubscriptionConsent,
      recordActivityNotificationSubscription
    } = require('../../../miniprogram/services/notification-service');

    const consent = await requestActivityNotificationSubscriptionConsent();

    expect(consent).toMatchObject({
      configured: true,
      templateKey: 'activity_notice',
      templateId: 'tmpl_123',
      status: 'accepted'
    });
    expect(call).not.toHaveBeenCalled();

    await recordActivityNotificationSubscription('activity_1', consent);

    expect(call).toHaveBeenCalledWith('recordNotificationSubscription', {
      activityId: 'activity_1',
      templateKey: 'activity_notice',
      templateId: 'tmpl_123',
      status: 'accepted'
    });
  });

  test('does nothing when the activity notice template id is not configured', async () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {}
    }));

    const { requestActivityNotificationSubscription } = require('../../../miniprogram/services/notification-service');

    await expect(requestActivityNotificationSubscription('activity_1')).resolves.toEqual({
      configured: false,
      skipped: true,
      reason: 'template-not-configured'
    });
    expect(global.wx.requestSubscribeMessage).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });

  test('does nothing when the manager registration notice template id is not configured', async () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        activityNotice: 'tmpl_activity'
      }
    }));

    const {
      requestManagerRegistrationNotificationSubscription
    } = require('../../../miniprogram/services/notification-service');

    await expect(
      requestManagerRegistrationNotificationSubscription('activity_1')
    ).resolves.toEqual({
      configured: false,
      skipped: true,
      reason: 'template-not-configured'
    });
    expect(global.wx.requestSubscribeMessage).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });

  test('notifies activity participants through the cloud function', async () => {
    jest.doMock('../../../miniprogram/config/env', () => ({
      SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
        activityNotice: 'tmpl_123'
      }
    }));
    call.mockResolvedValue({
      sent: 2
    });

    const { notifyActivityParticipants } = require('../../../miniprogram/services/notification-service');

    await expect(notifyActivityParticipants('activity_1', 'proceeding')).resolves.toEqual({
      sent: 2
    });
    expect(call).toHaveBeenCalledWith('notifyActivityParticipants', {
      activityId: 'activity_1',
      notificationType: 'proceeding'
    });
  });
});
