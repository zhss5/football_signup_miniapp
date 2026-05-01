const { call } = require('./cloud');

function joinActivity(payload) {
  return call('joinActivity', payload);
}

function addProxyRegistration(activityId, teamId, signupName) {
  return call('addProxyRegistration', { activityId, teamId, signupName });
}

function resolvePhoneNumber(code) {
  return call('resolvePhoneNumber', { code });
}

function cancelRegistration(activityId) {
  return call('cancelRegistration', { activityId });
}

function removeRegistration(activityId, userOpenId) {
  return call('removeRegistration', { activityId, userOpenId });
}

module.exports = {
  addProxyRegistration,
  joinActivity,
  resolvePhoneNumber,
  cancelRegistration,
  removeRegistration
};
