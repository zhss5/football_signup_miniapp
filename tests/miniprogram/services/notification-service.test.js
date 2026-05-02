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
