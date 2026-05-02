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

function getActivityCoverSources(activity = {}, preferredCover = 'thumb') {
  const coverImage = activity.coverImage || '';
  const coverThumbImage = activity.coverThumbImage || '';
  const orderedSources =
    preferredCover === 'cover'
      ? [coverImage, coverThumbImage]
      : [coverThumbImage, coverImage];

  return Array.from(new Set(orderedSources.filter(Boolean)));
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://');
}

function getResolvedCoverUrl(coverSource, urlByFileId = {}) {
  if (!coverSource) {
    return '';
  }

  const resolvedUrl = urlByFileId[coverSource] || '';

  if (isCloudFileId(coverSource)) {
    return resolvedUrl && !isCloudFileId(resolvedUrl) ? resolvedUrl : '';
  }

  return resolvedUrl || coverSource;
}

function getResolvedCoverDisplayImage(coverSources, urlByFileId) {
  const orderedSources = Array.isArray(coverSources) ? coverSources : [coverSources];

  for (const coverSource of orderedSources) {
    const resolvedUrl = getResolvedCoverUrl(coverSource, urlByFileId);

    if (resolvedUrl) {
      return resolvedUrl;
    }
  }

  return '';
}

function dedupeSources(sources) {
  return Array.from(new Set(sources.filter(Boolean)));
}

function getResolvedCoverImageSources(coverSources, urlByFileId) {
  const orderedSources = Array.isArray(coverSources) ? coverSources : [coverSources];

  return dedupeSources(
    orderedSources.reduce((sources, coverSource) => {
      const resolvedUrl = getResolvedCoverUrl(coverSource, urlByFileId);

      if (resolvedUrl) {
        sources.push(resolvedUrl);
      }

      if (isCloudFileId(coverSource)) {
        sources.push(coverSource);
      }

      return sources;
    }, [])
  );
}

async function resolveActivityCoverImages(items = [], options = {}) {
  const preferredCover = options.preferredCover || 'thumb';
  const coverSources = Array.from(
    new Set(
      items.reduce(
        (sources, item) => sources.concat(getActivityCoverSources(item, preferredCover)),
        []
      )
    )
  );
  const urlByFileId = await resolveFileUrls(coverSources);

  return items.map(item => {
    const coverSourceCandidates = getActivityCoverSources(item, preferredCover);
    const coverImageSources = getResolvedCoverImageSources(coverSourceCandidates, urlByFileId);

    return {
      ...item,
      coverDisplayImage: getResolvedCoverDisplayImage(coverSourceCandidates, urlByFileId),
      coverImageSources
    };
  });
}

async function resolveActivityCoverImage(activity) {
  if (!activity) {
    return activity;
  }

  const [resolvedActivity] = await resolveActivityCoverImages([activity], {
    preferredCover: 'cover'
  });
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
