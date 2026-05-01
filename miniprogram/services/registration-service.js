const { call } = require('./cloud');

function joinActivity(payload) {
  return call('joinActivity', payload);
}

function cancelRegistration(activityId) {
  return call('cancelRegistration', { activityId });
}

function removeRegistration(activityId, userOpenId) {
  return call('removeRegistration', { activityId, userOpenId });
}

module.exports = {
  joinActivity,
  cancelRegistration,
  removeRegistration
};
