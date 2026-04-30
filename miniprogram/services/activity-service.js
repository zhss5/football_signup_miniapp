const { call, resolveFileUrls } = require('./cloud');

function createActivity(payload) {
  return call('createActivity', payload);
}

function updateActivity(payload) {
  return call('updateActivity', payload);
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

function getActivityCoverSource(activity = {}) {
  return activity.coverThumbImage || activity.coverImage || '';
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://');
}

function getResolvedCoverDisplayImage(coverSource, urlByFileId) {
  if (!coverSource) {
    return '';
  }

  const resolvedUrl = urlByFileId[coverSource] || '';

  if (isCloudFileId(coverSource)) {
    return resolvedUrl && !isCloudFileId(resolvedUrl) ? resolvedUrl : '';
  }

  return resolvedUrl || coverSource;
}

async function resolveActivityCoverImages(items = []) {
  const coverSources = Array.from(new Set(items.map(getActivityCoverSource).filter(Boolean)));
  const urlByFileId = await resolveFileUrls(coverSources);

  return items.map(item => {
    const coverSource = getActivityCoverSource(item);

    return {
      ...item,
      coverDisplayImage: getResolvedCoverDisplayImage(coverSource, urlByFileId)
    };
  });
}

async function resolveActivityCoverImage(activity) {
  if (!activity) {
    return activity;
  }

  const [resolvedActivity] = await resolveActivityCoverImages([activity]);
  return resolvedActivity;
}

module.exports = {
  cancelActivity,
  createActivity,
  deleteActivity,
  listActivities,
  getActivityDetail,
  getActivityStats,
  resolveActivityCoverImage,
  resolveActivityCoverImages,
  updateActivity
};
