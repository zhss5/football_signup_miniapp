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

  function buildActivitySearchParams(input = {}) {
    return {
      scope: 'web-admin',
      keyword: String(input.keyword || '').trim(),
      status: String(input.status || '').trim(),
      organizerOpenId: String(input.organizerOpenId || '').trim(),
      startAtFrom: String(input.startAtFrom || '').trim(),
      startAtTo: String(input.startAtTo || '').trim(),
      limit: normalizeNumber(input.limit, 20) || 20,
      skip: normalizeNumber(input.skip, 0)
    };
  }

  function buildActivityRows(items = []) {
    return items.map(activity => ({
      activityId: activity._id || '',
      title: activity.title || '',
      startAt: activity.startAt || '',
      status: activity.status || '',
      confirmStatus: activity.confirmStatus || 'pending',
      statusText: `${activity.status || ''} / ${activity.confirmStatus || 'pending'}`,
      canConfirmProceeding:
        activity.status === 'published' && activity.confirmStatus !== 'confirmed',
      organizerOpenId: activity.organizerOpenId || '',
      joinedCount: Number(activity.joinedCount) || 0
    }));
  }

  function buildRosterRows(detail = {}) {
    return (Array.isArray(detail.teams) ? detail.teams : []).flatMap(team =>
      (Array.isArray(team.members) ? team.members : []).map(member => ({
        teamId: team._id || '',
        teamName: team.teamName || '',
        registrationId: member.registrationId || '',
        userOpenId: member.userOpenId || '',
        signupName: member.signupName || '',
        managerAlias: member.proxyRegistration ? '' : member.managerAlias || '',
        preferredPositions: Array.isArray(member.preferredPositions)
          ? member.preferredPositions.filter(Boolean).join(' / ')
          : '',
        proxyRegistration: Boolean(member.proxyRegistration),
        attendanceStatus: member.attendanceStatus || 'present'
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
      signupCount: Number(row.signupCount) || 0,
      presentCount: Number(row.presentCount) || 0,
      absentCount: Number(row.absentCount) || 0,
      attendanceRateText: toPercent(row.attendanceRate)
    }));
  }

  function buildActivityLogRows(items = []) {
    return items.map(log => ({
      id: log._id || log.id || '',
      type: log.action || '',
      operatorOpenId: log.operatorOpenId || '',
      targetOpenId: log.targetOpenId || log.userOpenId || '',
      status: '',
      createdAt: log.createdAt || ''
    }));
  }

  function buildNotificationLogRows(items = []) {
    return items.map(log => ({
      id: log._id || log.id || '',
      type: log.notificationType || log.type || '',
      operatorOpenId: log.operatorOpenId || '',
      targetOpenId: log.targetOpenId || log.userOpenId || '',
      status: log.status || '',
      createdAt: log.createdAt || ''
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
    buildNotificationLogRows,
    buildRosterRows,
    buildStatsRows,
    rowsToCsv
  };
});
