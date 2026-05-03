const DEFAULT_MEMBER_AVATAR_TEXT = '#';
const { t: translateText } = require('./i18n');

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

function defaultTranslate(key, params) {
  return translateText(key, params, 'en-US');
}

function getActivitySignupState(activity = {}, nowProvider, translate = defaultTranslate) {
  const now = resolveNow(nowProvider);
  const deadline = Date.parse(activity.signupDeadlineAt || '');
  const isDeleted = activity.status === 'deleted';
  const isCancelled = activity.status === 'cancelled';
  const isPublished = activity.status === 'published';
  const isFull = Number(activity.joinedCount) >= Number(activity.signupLimitTotal);
  const isSignupClosed = Number.isFinite(deadline) && now > deadline;

  if (isDeleted) {
    return { statusText: translate('activity.status.deleted'), joinEnabled: false };
  }

  if (isCancelled) {
    return { statusText: translate('activity.status.cancelled'), joinEnabled: false };
  }

  if (isFull) {
    return { statusText: translate('activity.status.full'), joinEnabled: false };
  }

  if (isPublished && isSignupClosed) {
    return { statusText: translate('activity.status.signupClosed'), joinEnabled: false };
  }

  if (isPublished) {
    return { statusText: translate('activity.status.joinable'), joinEnabled: true };
  }

  return { statusText: translate('activity.status.ended'), joinEnabled: false };
}

function buildActivityCardVm(activity, nowProvider, translate = defaultTranslate) {
  const { statusText, joinEnabled } = getActivitySignupState(activity, nowProvider, translate);

  return {
    ...activity,
    statusText,
    statusTone: joinEnabled ? 'joinable' : 'disabled',
    startDisplayText: formatDateTime(activity.startAt),
    capacityText: translate('activityCard.joinedCapacity', {
      joined: activity.joinedCount || 0,
      total: activity.signupLimitTotal || 0
    }),
    startPrefixText: translate('activityCard.start', {
      value: formatDateTime(activity.startAt)
    }),
    canCancelActivity: activity.status === 'published',
    canDeleteActivity: activity.status !== 'deleted' && Number(activity.joinedCount || 0) === 0
  };
}

function buildMemberVm(member, context = {}) {
  const sourceName = (member.signupName || member.displayName || '').trim();
  const isCurrentUser = Boolean(
    context.currentUserOpenId && member.userOpenId === context.currentUserOpenId
  );
  let memberAction = '';
  let memberActionText = '';

  if (isCurrentUser && context.canCancelSignup) {
    memberAction = 'cancelSignup';
    memberActionText = context.translate('activity.actions.cancelSignup');
  } else if (!isCurrentUser && context.canManageRegistrations) {
    memberAction = 'remove';
    memberActionText = context.translate('activity.actions.removeMember');
  }

  const moveActionVisible = Boolean(context.canManageRegistrations);
  const proxyBadgeVisible = Boolean(context.canManageRegistrations && member.proxyRegistration);
  const preferredPositions = Array.isArray(member.preferredPositions)
    ? member.preferredPositions.filter(Boolean)
    : [];
  const preferredPositionsVisible = preferredPositions.length > 0;

  return {
    ...member,
    avatarText: sourceName ? sourceName.charAt(0).toUpperCase() : DEFAULT_MEMBER_AVATAR_TEXT,
    isCurrentUser,
    memberAction,
    memberActionText,
    moveActionVisible,
    moveActionText: moveActionVisible ? context.translate('activity.actions.moveMember') : '',
    proxyBadgeVisible,
    proxyBadgeText: proxyBadgeVisible ? context.translate('activity.member.proxySignup') : '',
    preferredPositionsVisible,
    preferredPositionsText: preferredPositionsVisible ? preferredPositions.join(' / ') : ''
  };
}

function buildTeamListVm(
  teams = [],
  myRegistration = null,
  activity = null,
  nowProvider,
  translate = defaultTranslate,
  options = {}
) {
  const hasJoined = Boolean(myRegistration && myRegistration.status === 'joined');
  const signupState = getActivitySignupState(activity || {}, nowProvider, translate);
  const currentUserOpenId = myRegistration && myRegistration.userOpenId;
  const memberContext = {
    canCancelSignup: Boolean(options.canCancelSignup),
    canManageRegistrations: Boolean(options.canManageRegistrations),
    currentUserOpenId,
    translate
  };

  return teams.map(team => {
    const isFull = Number(team.joinedCount) >= Number(team.maxMembers);
    let joinDisabled = !signupState.joinEnabled || isFull;
    let joinButtonText = signupState.joinEnabled
      ? translate('activity.status.joinable')
      : signupState.statusText;

    if (isFull) {
      joinButtonText = translate('activity.status.full');
    }

    if (hasJoined) {
      joinDisabled = true;
      joinButtonText = translate('activity.status.joined');
    }

    const joinActionVisible = !joinDisabled;
    const canProxySignup = Boolean(
      options.canManageRegistrations && signupState.joinEnabled && !isFull
    );

    return {
      ...team,
      joinDisabled,
      joinButtonText,
      joinActionVisible,
      joinActionText: joinActionVisible ? translate('activity.actions.join') : '',
      canProxySignup,
      proxySignupText: canProxySignup ? translate('activity.actions.proxySignup') : '',
      members: Array.isArray(team.members)
        ? team.members.map(member => buildMemberVm(member, memberContext))
        : []
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
