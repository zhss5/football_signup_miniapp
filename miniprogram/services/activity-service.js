const { call } = require('./cloud');

function createActivity(payload) {
  return call('createActivity', payload);
}

function listActivities(params) {
  return call('listActivities', params);
}

function getActivityDetail(activityId) {
  return call('getActivityDetail', { activityId });
}

module.exports = {
  createActivity,
  listActivities,
  getActivityDetail
};
