const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function normalizePhoneInfo(info) {
  const phoneNumber = String(info.phoneNumber || info.purePhoneNumber || '').trim();

  if (!phoneNumber) {
    throw new Error('Phone authorization failed');
  }

  return {
    phoneNumber,
    purePhoneNumber: String(info.purePhoneNumber || phoneNumber).trim(),
    countryCode: String(info.countryCode || '').trim(),
    phoneSource: 'wechat'
  };
}

async function defaultResolvePhoneNumber(code) {
  const result = await cloud.openapi.phonenumber.getPhoneNumber({ code });
  return result.phoneInfo || result.phone_info || {};
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const code = String((event && event.code) || '').trim();

  if (!code) {
    throw new Error('Phone authorization code is required');
  }

  const resolver = deps.resolvePhoneNumber || defaultResolvePhoneNumber;
  const phoneInfo = await resolver(code);
  return normalizePhoneInfo(phoneInfo || {});
}

module.exports = { main };
