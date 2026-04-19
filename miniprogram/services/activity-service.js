const { call } = require('./cloud');

function createActivity(payload) {
  return call('createActivity', payload);
}

function cancelActivity(activityId) {
  return call('cancelActivity', { activityId });
}

function deleteActivity(activityId) {
  return call('deleteActivity', { activityId });
}

function listActivities(params) {
  return call('listActivities', params);
}

function getActivityDetail(activityId) {
  return call('getActivityDetail', { activityId });
}

function getActivityStats(activityId) {
  return call('getActivityStats', { activityId });
}

module.exports = {
  cancelActivity,
  createActivity,
  deleteActivity,
  listActivities,
  getActivityDetail,
  getActivityStats
};
