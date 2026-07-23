const { call } = require('./cloud');
const { SUBSCRIBE_MESSAGE_TEMPLATE_IDS = {} } = require('../config/env');

const ACTIVITY_NOTICE_TEMPLATE_KEY = 'activity_notice';
const MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY = 'manager_registration_notice';
const MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY =
  'manager_late_cancellation_notice';

function getWxRuntime() {
  if (typeof wx !== 'undefined' && wx) {
    return wx;
  }

  if (typeof globalThis !== 'undefined' && globalThis.wx) {
    return globalThis.wx;
  }

  return null;
}

function getActivityNoticeTemplateId() {
  return (
    SUBSCRIBE_MESSAGE_TEMPLATE_IDS.activityNotice ||
    SUBSCRIBE_MESSAGE_TEMPLATE_IDS.activity_notice ||
    ''
  );
}

function getManagerRegistrationNoticeTemplateId() {
  return (
    SUBSCRIBE_MESSAGE_TEMPLATE_IDS.managerRegistrationNotice ||
    SUBSCRIBE_MESSAGE_TEMPLATE_IDS.manager_registration_notice ||
    ''
  );
}

function getManagerLateCancellationNoticeTemplateId() {
  return (
    SUBSCRIBE_MESSAGE_TEMPLATE_IDS.managerLateCancellationNotice ||
    SUBSCRIBE_MESSAGE_TEMPLATE_IDS.manager_late_cancellation_notice ||
    ''
  );
}

function normalizeSubscribeStatus(value) {
  return value === 'accept' || value === 'accepted' ? 'accepted' : 'declined';
}

function requestSubscribeMessage(wxRuntime, templateIds) {
  return new Promise((resolve, reject) => {
    wxRuntime.requestSubscribeMessage({
      tmplIds: Array.isArray(templateIds) ? templateIds : [templateIds],
      success: resolve,
      fail: reject
    });
  });
}

function getManagerNoticeTemplates(templateKeys) {
  const selectedKeys = Array.isArray(templateKeys) && templateKeys.length
    ? new Set(templateKeys)
    : null;
  const templates = [
    {
      templateKey: MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY,
      templateId: getManagerRegistrationNoticeTemplateId()
    },
    {
      templateKey: MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY,
      templateId: getManagerLateCancellationNoticeTemplateId()
    }
  ];

  return templates.filter(
    ({ templateKey, templateId }) =>
      templateId && (!selectedKeys || selectedKeys.has(templateKey))
  );
}

async function requestActivityNotificationSubscription(activityId) {
  const subscription = await requestActivityNotificationSubscriptionConsent();
  await recordActivityNotificationSubscription(activityId, subscription);

  return subscription;
}

async function requestManagerRegistrationNotificationSubscription(activityId) {
  const subscription = await requestManagerRegistrationNotificationSubscriptionConsent();
  await recordActivityNotificationSubscription(activityId, subscription);

  return subscription;
}

async function requestManagerNotificationSubscriptions(activityId, templateKeys) {
  const subscriptions = await requestManagerNotificationSubscriptionsConsent(templateKeys);

  for (const subscription of subscriptions) {
    await recordActivityNotificationSubscription(activityId, subscription);
  }

  return subscriptions;
}

async function requestActivityNotificationSubscriptionConsent() {
  const templateId = getActivityNoticeTemplateId();

  if (!templateId) {
    return {
      configured: false,
      skipped: true,
      reason: 'template-not-configured'
    };
  }

  const wxRuntime = getWxRuntime();
  if (!wxRuntime || typeof wxRuntime.requestSubscribeMessage !== 'function') {
    return {
      configured: true,
      skipped: true,
      reason: 'subscribe-api-unavailable'
    };
  }

  const requestResult = await requestSubscribeMessage(wxRuntime, templateId);
  const status = normalizeSubscribeStatus(requestResult && requestResult[templateId]);

  return {
    configured: true,
    templateKey: ACTIVITY_NOTICE_TEMPLATE_KEY,
    templateId,
    status
  };
}

async function requestManagerRegistrationNotificationSubscriptionConsent() {
  const [subscription] = await requestManagerNotificationSubscriptionsConsent([
    MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY
  ]);

  if (!subscription) {
    return {
      configured: false,
      skipped: true,
      reason: 'template-not-configured'
    };
  }

  return subscription;
}

async function requestManagerNotificationSubscriptionsConsent(templateKeys) {
  const templates = getManagerNoticeTemplates(templateKeys);
  if (!templates.length) {
    return [];
  }

  const wxRuntime = getWxRuntime();
  if (!wxRuntime || typeof wxRuntime.requestSubscribeMessage !== 'function') {
    return templates.map(({ templateKey, templateId }) => ({
      configured: true,
      templateKey,
      templateId,
      skipped: true,
      reason: 'subscribe-api-unavailable'
    }));
  }

  const requestResult = await requestSubscribeMessage(
    wxRuntime,
    templates.map(({ templateId }) => templateId)
  );

  return templates.map(({ templateKey, templateId }) => ({
    configured: true,
    templateKey,
    templateId,
    status: normalizeSubscribeStatus(requestResult && requestResult[templateId])
  }));
}

async function recordActivityNotificationSubscription(activityId, subscription = {}) {
  if (
    !activityId ||
    !subscription.configured ||
    subscription.skipped ||
    !subscription.templateId
  ) {
    return {
      skipped: true,
      reason: 'subscription-not-recordable'
    };
  }

  return call('recordNotificationSubscription', {
    activityId,
    templateKey: subscription.templateKey || ACTIVITY_NOTICE_TEMPLATE_KEY,
    templateId: subscription.templateId,
    status: normalizeSubscribeStatus(subscription.status)
  });
}

function notifyActivityParticipants(activityId, notificationType) {
  return call('notifyActivityParticipants', {
    activityId,
    notificationType
  });
}

module.exports = {
  ACTIVITY_NOTICE_TEMPLATE_KEY,
  MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY,
  MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY,
  getManagerLateCancellationNoticeTemplateId,
  getManagerRegistrationNoticeTemplateId,
  notifyActivityParticipants,
  recordActivityNotificationSubscription,
  requestActivityNotificationSubscriptionConsent,
  requestActivityNotificationSubscription,
  requestManagerNotificationSubscriptionsConsent,
  requestManagerNotificationSubscriptions,
  requestManagerRegistrationNotificationSubscriptionConsent,
  requestManagerRegistrationNotificationSubscription
};
