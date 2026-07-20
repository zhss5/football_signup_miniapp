(function initActivityManagement(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.WebAdminActivityManagement = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function activityManagementFactory() {
  function normalizeNumber(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      return fallback;
    }

    return Math.floor(number);
  }

  function padDatePart(value) {
    return String(value).padStart(2, '0');
  }

  function formatBeijingDateTime(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }

    const timestamp = Date.parse(text);
    if (!Number.isFinite(timestamp)) {
      return text;
    }

    const beijingDate = new Date(timestamp + 8 * 60 * 60 * 1000);
    return [
      beijingDate.getUTCFullYear(),
      padDatePart(beijingDate.getUTCMonth() + 1),
      padDatePart(beijingDate.getUTCDate())
    ].join('-') + ' ' + [
      padDatePart(beijingDate.getUTCHours()),
      padDatePart(beijingDate.getUTCMinutes())
    ].join(':');
  }

  function buildActivitySearchParams(input = {}) {
    return {
      scope: 'web-admin',
      keyword: String(input.keyword || '').trim(),
      status: String(input.status || '').trim(),
      organizerKeyword: String(input.organizerKeyword || '').trim(),
      organizerOpenId: String(input.organizerOpenId || '').trim(),
      startAtFrom: String(input.startAtFrom || '').trim(),
      startAtTo: String(input.startAtTo || '').trim(),
      limit: normalizeNumber(input.limit, 20) || 20,
      skip: normalizeNumber(input.skip, 0)
    };
  }

  function normalizeActivityType(value) {
    const type = String(value || '').trim();
    return type === 'external' ? 'external' : 'internal';
  }

  function formatActivityType(value) {
    return normalizeActivityType(value) === 'external' ? '外战' : '内战';
  }

  function buildActivityRows(items = []) {
    return items.map(activity => ({
      activityId: activity._id || '',
      title: activity.title || '',
      startAt: formatBeijingDateTime(activity.startAt),
      status: activity.status || '',
      confirmStatus: activity.confirmStatus || 'pending',
      activityType: normalizeActivityType(activity.activityType),
      activityTypeText: formatActivityType(activity.activityType),
      statusText: activity.status || '',
      canConfirmProceeding:
        activity.status === 'published' && activity.confirmStatus !== 'confirmed',
      organizerOpenId: activity.organizerOpenId || '',
      organizerName: String(activity.organizerName || activity.organizerPreferredName || '').trim(),
      organizerManagerAlias: String(activity.organizerManagerAlias || '').trim(),
      organizerDisplayName: getPreferredDisplayName(
        activity.organizerName || activity.organizerPreferredName || '',
        activity.organizerManagerAlias
      ) || activity.organizerOpenId || '',
      joinedCount: Number(activity.joinedCount) || 0,
      signupLimitTotal: Number(activity.signupLimitTotal) || 0
    }));
  }

  function buildRosterRows(detail = {}) {
    const activityType = normalizeActivityType(detail.activity && detail.activity.activityType);

    return (Array.isArray(detail.teams) ? detail.teams : []).flatMap(team =>
      (Array.isArray(team.members) ? team.members : []).map(member => ({
        teamId: team._id || '',
        teamName: team.teamName || '',
        activityType,
        activityTypeText: formatActivityType(activityType),
        registrationId: member.registrationId || '',
        userOpenId: member.userOpenId || '',
        signupName: member.signupName || '',
        managerAlias: member.proxyRegistration ? '' : member.managerAlias || '',
        avatarUrl: String(member.avatarUrl || '').trim(),
        preferredPositions: Array.isArray(member.preferredPositions)
          ? member.preferredPositions.filter(Boolean).join(' / ')
          : '',
        proxyRegistration: Boolean(member.proxyRegistration),
        attendanceStatus: member.attendanceStatus || 'present',
        performanceDescription: String(member.performanceDescription || '').trim()
      }))
    );
  }

  function buildAttendanceRows(rows = []) {
    return rows.map(row => ({
      ...row,
      nextAttendanceStatus: row.attendanceStatus === 'absent' ? 'present' : 'absent'
    }));
  }

  function toPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return '0.00%';
    }

    return `${(number * 100).toFixed(2)}%`;
  }

  function buildStatsRows(items = []) {
    return items.map(row => ({
      participantName: row.participantName || '',
      managerAlias: row.managerAlias || '',
      signupCount: Number(row.signupCount) || 0,
      presentCount: Number(row.presentCount) || 0,
      absentCount: Number(row.absentCount) || 0,
      attendanceRateText: toPercent(row.attendanceRate),
      effectiveSignupActivityCount: Number(row.effectiveSignupActivityCount) || 0,
      cancelledActivityCount: Number(row.cancelledActivityCount) || 0,
      cancelRateText: toPercent(row.cancelRate),
      details: (Array.isArray(row.details) ? row.details : []).map(detail => ({
        activityId: detail.activityId || '',
        activityTitle: detail.activityTitle || '',
        teamName: detail.teamName || '',
        signupName: detail.signupName || '',
        managerAlias: detail.managerAlias || '',
        attendanceStatus: detail.attendanceStatus || 'present',
        startAt: formatBeijingDateTime(detail.startAt)
      }))
    }));
  }

  const ATTENDANCE_LABELS = {
    absent: '缺勤',
    present: '出勤'
  };

  function formatBlankText(value) {
    const text = String(value || '').trim();
    return text || '空';
  }

  function shortenOpenId(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }

    if (text.length <= 12) {
      return text;
    }

    return `${text.slice(0, 6)}...${text.slice(-4)}`;
  }

  function getLogTargetName(log) {
    return String(
      log.targetName ||
      (log.after && log.after.signupName) ||
      log.targetOpenId ||
      log.userOpenId ||
      log.registrationId ||
      '报名人'
    ).trim();
  }

  function getLogTargetDisplayName(log) {
    const targetOpenId = log.targetOpenId || log.userOpenId || '';
    const targetName = getLogTargetName(log);

    return targetName && targetName !== targetOpenId
      ? targetName
      : shortenOpenId(targetOpenId);
  }

  function getPreferredDisplayName(name, managerAlias) {
    const displayName = String(name || '').trim();
    const alias = String(managerAlias || '').trim();

    return alias || displayName;
  }

  function getLogOperatorName(log) {
    return String(
      log.operatorName ||
      log.operatorDisplayName ||
      log.operatorPreferredName ||
      ''
    ).trim();
  }

  function getLogOperatorDisplayName(log, targetDisplayName) {
    const operatorName = getLogOperatorName(log);
    const operatorOpenId = String(log.operatorOpenId || '').trim();
    const targetOpenId = String(log.targetOpenId || log.userOpenId || '').trim();

    if (operatorName) {
      return getPreferredDisplayName(operatorName, log.operatorManagerAlias);
    }

    if (operatorOpenId && operatorOpenId === targetOpenId && targetDisplayName) {
      return targetDisplayName;
    }

    return shortenOpenId(operatorOpenId);
  }

  function formatTeamSuffix(teamName) {
    const text = String(teamName || '').trim();
    return text ? ` ${text}` : '';
  }

  function buildActivityLogSummary(log = {}, targetDisplayName) {
    const targetName = targetDisplayName || getLogTargetDisplayName(log);

    if (log.action === 'signup_joined') {
      return `${targetName} 报名${formatTeamSuffix(log.teamName)}`;
    }

    if (log.action === 'signup_rejoined') {
      return `${targetName} 重新报名${formatTeamSuffix(log.teamName)}`;
    }

    if (log.action === 'signup_cancelled') {
      return `${targetName} 取消报名`;
    }

    if (log.action === 'proxy_signup_created') {
      return `${targetName} 代报名${formatTeamSuffix(log.teamName)}`;
    }

    if (log.action === 'registration_removed') {
      return `${targetName} 被移除`;
    }

    if (log.action === 'registration_moved') {
      const fromTeam = String(log.fromTeamName || log.fromTeamId || '').trim();
      const toTeam = String(log.toTeamName || log.toTeamId || '').trim();
      if (fromTeam && toTeam) {
        return `${targetName} 从 ${fromTeam} 换到 ${toTeam}`;
      }

      return `${targetName} 换队`;
    }

    if (log.action === 'manager_alias_update') {
      const beforeAlias = log.before && log.before.managerAlias;
      const afterAlias = log.after && log.after.managerAlias;
      return `${targetName} 备注从 ${formatBlankText(beforeAlias)} 改为 ${formatBlankText(afterAlias)}`;
    }

    if (log.action === 'attendance_update') {
      const status = log.attendanceStatus || (log.after && log.after.attendanceStatus);
      return `${targetName} 标记为${ATTENDANCE_LABELS[status] || status || '出勤状态'}`;
    }

    if (log.action === 'activity_summary_update') {
      return '更新活动总结';
    }

    if (log.action === 'performance_description_update') {
      return `${targetName} 更新表现描述`;
    }

    return log.action || '';
  }

  function buildActivityLogRows(items = []) {
    return items.map(log => {
      const targetDisplayName = getPreferredDisplayName(
        getLogTargetDisplayName(log),
        log.targetManagerAlias
      );
      const operatorName = getLogOperatorName(log);

      return {
        id: log._id || log.id || '',
        activityId: log.activityId || '',
        activityTitle: log.activityTitle || '',
        type: log.action || '',
        operatorOpenId: log.operatorOpenId || '',
        operatorName,
        operatorManagerAlias: log.operatorManagerAlias || '',
        operatorDisplayName: getLogOperatorDisplayName(log, targetDisplayName),
        targetOpenId: log.targetOpenId || log.userOpenId || '',
        targetName: getLogTargetName(log),
        targetManagerAlias: log.targetManagerAlias || '',
        targetDisplayName,
        summary: buildActivityLogSummary(log, targetDisplayName),
        status: '',
        createdAt: formatBeijingDateTime(log.createdAt)
      };
    });
  }

  function buildNotificationLogRows(items = []) {
    return items.map(log => ({
      id: log._id || log.id || '',
      activityId: log.activityId || '',
      activityTitle: log.activityTitle || '',
      type: log.notificationType || log.type || '',
      operatorOpenId: log.operatorOpenId || '',
      targetOpenId: log.targetOpenId || log.userOpenId || '',
      status: log.status || '',
      errorMessage: log.errorMessage || log.error || '',
      createdAt: formatBeijingDateTime(log.createdAt)
    }));
  }

  function escapeCsvValue(value) {
    const text = Array.isArray(value) ? value.join(' / ') : String(value ?? '');
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  function rowsToCsv(rows = []) {
    if (!rows.length) {
      return '';
    }

    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map(row => headers.map(header => escapeCsvValue(row[header])).join(','))
    ];

    return lines.join('\r\n');
  }

  return {
    buildActivityLogRows,
    buildActivityRows,
    buildActivitySearchParams,
    buildAttendanceRows,
    formatActivityType,
    formatBeijingDateTime,
    buildNotificationLogRows,
    buildRosterRows,
    buildStatsRows,
    rowsToCsv
  };
});
