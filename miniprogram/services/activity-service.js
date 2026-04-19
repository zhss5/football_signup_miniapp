const { call } = require('./cloud');

function listActivities(params) {
  return call('listActivities', params);
}

function getActivityDetail(activityId) {
  return call('getActivityDetail', { activityId });
}

module.exports = {
  listActivities,
  getActivityDetail
};
