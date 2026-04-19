const DEFAULT_MEMBER_AVATAR_TEXT = '#';

function resolveNow(nowProvider) {
  return typeof nowProvider === 'function' ? nowProvider() : Date.now();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getActivitySignupState(activity = {}, nowProvider) {
  const now = resolveNow(nowProvider);
  const deadline = Date.parse(activity.signupDeadlineAt || '');
  const isDeleted = activity.status === 'deleted';
  const isCancelled = activity.status === 'cancelled';
  const isPublished = activity.status === 'published';
  const isFull = Number(activity.joinedCount) >= Number(activity.signupLimitTotal);
  const isSignupClosed = Number.isFinite(deadline) && now > deadline;

  if (isDeleted) {
    return { statusText: 'Deleted', joinEnabled: false };
  }

  if (isCancelled) {
    return { statusText: 'Cancelled', joinEnabled: false };
  }

  if (isFull) {
    return { statusText: 'Full', joinEnabled: false };
  }

  if (isPublished && isSignupClosed) {
    return { statusText: 'Signup Closed', joinEnabled: false };
  }

  if (isPublished) {
    return { statusText: 'Joinable', joinEnabled: true };
  }

  return { statusText: 'Ended', joinEnabled: false };
}

function buildActivityCardVm(activity, nowProvider) {
  const { statusText } = getActivitySignupState(activity, nowProvider);

  return {
    ...activity,
    statusText,
    startDisplayText: formatDateTime(activity.startAt),
    capacityText: `Joined ${activity.joinedCount || 0} / ${activity.signupLimitTotal || 0}`,
    canCancelActivity: activity.status === 'published',
    canDeleteActivity: activity.status !== 'deleted' && Number(activity.joinedCount || 0) === 0
  };
}

function buildMemberVm(member) {
  const sourceName = (member.signupName || member.displayName || '').trim();

  return {
    ...member,
    avatarText: sourceName ? sourceName.charAt(0).toUpperCase() : DEFAULT_MEMBER_AVATAR_TEXT
  };
}

function buildTeamListVm(teams = [], myRegistration = null, activity = null, nowProvider) {
  const hasJoined = Boolean(myRegistration && myRegistration.status === 'joined');
  const signupState = getActivitySignupState(activity || {}, nowProvider);

  return teams.map(team => {
    const isFull = Number(team.joinedCount) >= Number(team.maxMembers);
    let joinDisabled = !signupState.joinEnabled || isFull;
    let joinButtonText = signupState.joinEnabled ? 'Join' : signupState.statusText;

    if (isFull) {
      joinButtonText = 'Full';
    }

    if (hasJoined) {
      joinDisabled = true;
      joinButtonText = 'Joined';
    }

    return {
      ...team,
      joinDisabled,
      joinButtonText,
      members: Array.isArray(team.members) ? team.members.map(buildMemberVm) : []
    };
  });
}

module.exports = {
  DEFAULT_MEMBER_AVATAR_TEXT,
  buildActivityCardVm,
  buildTeamListVm,
  formatDateTime,
  getActivitySignupState
};
