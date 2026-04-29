const { call } = require('./cloud');

function joinActivity(payload) {
  return call('joinActivity', payload);
}

function resolvePhoneNumber(code) {
  return call('resolvePhoneNumber', { code });
}

function cancelRegistration(activityId) {
  return call('cancelRegistration', { activityId });
}

module.exports = {
  joinActivity,
  resolvePhoneNumber,
  cancelRegistration
};
