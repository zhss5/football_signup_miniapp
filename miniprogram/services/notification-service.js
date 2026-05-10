const { call } = require('./cloud');
const { SUBSCRIBE_MESSAGE_TEMPLATE_IDS = {} } = require('../config/env');

const ACTIVITY_NOTICE_TEMPLATE_KEY = 'activity_notice';
const MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY = 'manager_registration_notice';

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

function normalizeSubscribeStatus(value) {
  return value === 'accept' || value === 'accepted' ? 'accepted' : 'declined';
}

function requestSubscribeMessage(wxRuntime, templateId) {
  return new Promise((resolve, reject) => {
    wxRuntime.requestSubscribeMessage({
      tmplIds: [templateId],
      success: resolve,
      fail: reject
    });
  });
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
  const templateId = getManagerRegistrationNoticeTemplateId();

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
    templateKey: MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY,
    templateId,
    status
  };
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
  MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY,
  notifyActivityParticipants,
  recordActivityNotificationSubscription,
  requestActivityNotificationSubscriptionConsent,
  requestActivityNotificationSubscription,
  requestManagerRegistrationNotificationSubscriptionConsent,
  requestManagerRegistrationNotificationSubscription
};
