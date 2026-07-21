const DEFAULT_MEMBER_AVATAR_TEXT = '#';
const { t: translateText } = require('./i18n');
const { getTeamColorOption } = require('./team-colors');

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

function isActivityExpired(activity = {}, nowProvider) {
  const endAt = Date.parse(activity.endAt || '');
  return (
    activity.status === 'published' &&
    Number.isFinite(endAt) &&
    resolveNow(nowProvider) > endAt
  );
}

function isActivityStarted(activity = {}, nowProvider) {
  const startAt = Date.parse(activity.startAt || '');
  return (
    activity.status === 'published' &&
    Number.isFinite(startAt) &&
    resolveNow(nowProvider) >= startAt
  );
}

function getActivitySignupState(activity = {}, nowProvider, translate = defaultTranslate) {
  const now = resolveNow(nowProvider);
  const deadline = Date.parse(activity.signupDeadlineAt || '');
  const isDeleted = activity.status === 'deleted';
  const isCancelled = activity.status === 'cancelled';
  const isPublished = activity.status === 'published';
  const isExpired = isActivityExpired(activity, () => now);
  const isFull = Number(activity.joinedCount) >= Number(activity.signupLimitTotal);
  const isSignupClosed = Number.isFinite(deadline) && now > deadline;

  if (isDeleted) {
    return {
      stateKey: 'deleted',
      statusText: translate('activity.status.deleted'),
      joinEnabled: false,
      isExpired: false
    };
  }

  if (isCancelled) {
    return {
      stateKey: 'cancelled',
      statusText: translate('activity.status.cancelled'),
      joinEnabled: false,
      isExpired: false
    };
  }

  if (isExpired) {
    return {
      stateKey: 'expired',
      statusText: translate('activity.status.expired'),
      joinEnabled: false,
      isExpired: true
    };
  }

  if (isFull) {
    return {
      stateKey: 'full',
      statusText: translate('activity.status.full'),
      joinEnabled: false,
      isExpired: false
    };
  }

  if (isPublished && isSignupClosed) {
    return {
      stateKey: 'signupClosed',
      statusText: translate('activity.status.signupClosed'),
      joinEnabled: false,
      isExpired: false
    };
  }

  if (isPublished) {
    return {
      stateKey: 'joinable',
      statusText: translate('activity.status.joinable'),
      joinEnabled: true,
      isExpired: false
    };
  }

  return {
    stateKey: 'ended',
    statusText: translate('activity.status.ended'),
    joinEnabled: false,
    isExpired: false
  };
}

function buildActivityCardVm(activity, nowProvider, translate = defaultTranslate) {
  const { statusText, joinEnabled, isExpired } = getActivitySignupState(
    activity,
    nowProvider,
    translate
  );

  return {
    ...activity,
    statusText,
    statusTone: isExpired ? 'expired' : joinEnabled ? 'joinable' : 'disabled',
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

  const moveActionVisible = Boolean(
    context.canManageRegistrations && context.canMoveRegistration !== false
  );
  const proxyBadgeVisible = Boolean(context.canManageRegistrations && member.proxyRegistration);
  const preferredPositions = Array.isArray(member.preferredPositions)
    ? member.preferredPositions.filter(Boolean)
    : [];
  const preferredPositionsVisible = preferredPositions.length > 0;
  const attendanceStatus = member.attendanceStatus === 'absent' ? 'absent' : 'present';
  const attendanceStatusVisible = false;
  const attendanceActionVisible = Boolean(context.canManageAttendance && member.registrationId);
  const attendanceActionStatus = attendanceStatus === 'absent' ? 'present' : 'absent';
  const managerAliasText = String(member.managerAlias || '').trim();
  const managerAliasActionVisible = Boolean(
    context.canManageRegistrations &&
      member.userOpenId &&
      !member.proxyRegistration &&
      !String(member.userOpenId).startsWith('proxy_')
  );
  const selfProfileEditVisible = Boolean(
    isCurrentUser &&
      context.canEditSelfProfile &&
      !member.proxyRegistration &&
      !String(member.userOpenId || '').startsWith('proxy_')
  );

  return {
    ...member,
    attendanceStatus,
    managerAlias: managerAliasActionVisible ? managerAliasText : '',
    avatarText: sourceName ? sourceName.charAt(0).toUpperCase() : DEFAULT_MEMBER_AVATAR_TEXT,
    isCurrentUser,
    memberAction,
    memberActionText,
    moveActionVisible,
    moveActionText: moveActionVisible ? context.translate('activity.actions.moveMember') : '',
    proxyBadgeVisible,
    proxyBadgeText: proxyBadgeVisible ? context.translate('activity.member.proxySignup') : '',
    preferredPositionsVisible,
    preferredPositionsText: preferredPositionsVisible ? preferredPositions.join(' / ') : '',
    attendanceStatusVisible,
    attendanceStatusText: context.canManageAttendance
      ? context.translate(`activity.attendance.${attendanceStatus}`)
      : '',
    attendanceActionVisible,
    attendanceActionStatus,
    attendanceActionText: attendanceActionVisible
      ? context.translate(
          attendanceActionStatus === 'present'
            ? 'activity.actions.markPresent'
            : 'activity.actions.markAbsent'
        )
      : '',
    managerAliasVisible: Boolean(managerAliasActionVisible && managerAliasText),
    managerAliasText: managerAliasActionVisible ? managerAliasText : '',
    managerAliasActionVisible,
    managerAliasActionText: managerAliasActionVisible
      ? context.translate('activity.actions.managerAlias')
      : '',
    selfProfileEditVisible,
    selfProfileEditText: selfProfileEditVisible
      ? context.translate('activity.actions.editRegistrationProfile')
      : ''
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
  const now = resolveNow(nowProvider);
  const stableNowProvider = () => now;
  const signupState = getActivitySignupState(activity || {}, stableNowProvider, translate);
  const currentUserOpenId = myRegistration && myRegistration.userOpenId;
  const startAt = Date.parse((activity && activity.startAt) || '');
  const canEditSelfProfile = Boolean(
    hasJoined &&
      myRegistration.proxyRegistration !== true &&
      activity &&
      activity.status === 'published' &&
      Number.isFinite(startAt) &&
      now < startAt
  );
  const memberContext = {
    canCancelSignup: Boolean(options.canCancelSignup),
    canManageRegistrations: Boolean(options.canManageRegistrations),
    canManageAttendance: Boolean(options.canManageRegistrations),
    canEditSelfProfile,
    currentUserOpenId,
    translate
  };
  const hasAvailableRegularTeam = teams.some(team =>
    team &&
    team.status !== 'inactive' &&
    team.teamType !== 'bench' &&
    Number(team.joinedCount || 0) < Number(team.maxMembers || 0)
  );

  return teams.map((team, index) => {
    const colorOption = getTeamColorOption(team.colorKey, index);
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
      options.canManageRegistrations &&
      signupState.joinEnabled &&
      !isFull &&
      !(team.teamType === 'bench' && hasAvailableRegularTeam)
    );

    return {
      ...team,
      teamColorKey: colorOption.key,
      teamColorClass: colorOption.className,
      teamColorRequiresBorder: colorOption.requiresBorder,
      canEditColor: Boolean(options.canEditTeamColor),
      joinDisabled,
      joinButtonText,
      joinActionVisible,
      joinActionText: joinActionVisible ? translate('activity.actions.join') : '',
      canProxySignup,
      proxySignupText: canProxySignup ? translate('activity.actions.proxySignup') : '',
      members: Array.isArray(team.members)
        ? team.members.map(member => buildMemberVm(member, {
            ...memberContext,
            canMoveRegistration: team.teamType !== 'bench'
          }))
        : []
    };
  });
}

module.exports = {
  DEFAULT_MEMBER_AVATAR_TEXT,
  buildActivityCardVm,
  buildTeamListVm,
  formatDateTime,
  getActivitySignupState,
  isActivityExpired,
  isActivityStarted
};
