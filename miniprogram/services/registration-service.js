const { call } = require('./cloud');

function joinActivity(payload) {
  return call('joinActivity', payload);
}

function cancelRegistration(activityId) {
  return call('cancelRegistration', { activityId });
}

module.exports = {
  joinActivity,
  cancelRegistration
};
