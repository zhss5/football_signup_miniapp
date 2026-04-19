function buildActivityCardVm(activity) {
  let statusText = 'Joinable';

  if (activity.status !== 'published') {
    statusText = 'Ended';
  }

  if (activity.joinedCount >= activity.signupLimitTotal) {
    statusText = 'Full';
  }

  return {
    ...activity,
    statusText
  };
}

module.exports = {
  buildActivityCardVm
};
