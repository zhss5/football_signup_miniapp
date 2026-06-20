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
      startAt: formatBeijingDateTime(activity.startAt),
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
      managerAlias: row.managerAlias || '',
      signupCount: Number(row.signupCount) || 0,
      presentCount: Number(row.presentCount) || 0,
      absentCount: Number(row.absentCount) || 0,
      attendanceRateText: toPercent(row.attendanceRate)
    }));
  }

  const IMPORT_STAT_HEADER_ALIASES = {
    participantName: ['参与者', '报名人', '报名名', '姓名', '名称', 'participantname', 'name', 'signupname'],
    managerAlias: ['备注', '管理备注', '识别名', 'manageralias', 'alias', 'note'],
    signupCount: ['报名次数', '报名数', '总报名', 'signupcount', 'signups'],
    presentCount: ['出勤', '出勤次数', 'presentcount', 'present'],
    absentCount: ['缺勤', '缺勤次数', 'absentcount', 'absent'],
    attendanceRateText: ['出勤率', 'attendancerate', 'attendanceratetext', 'rate']
  };

  function normalizeImportText(value) {
    return String(value ?? '').replace(/^\uFEFF/, '').trim();
  }

  function normalizeImportHeader(value) {
    return normalizeImportText(value).replace(/\s+/g, '').toLowerCase();
  }

  function buildImportHeaderIndex(headers = []) {
    const normalizedHeaders = headers.map(normalizeImportHeader);

    return Object.keys(IMPORT_STAT_HEADER_ALIASES).reduce((index, fieldName) => {
      const aliases = IMPORT_STAT_HEADER_ALIASES[fieldName].map(normalizeImportHeader);
      const columnIndex = normalizedHeaders.findIndex(header => aliases.includes(header));

      if (columnIndex >= 0) {
        index[fieldName] = columnIndex;
      }

      return index;
    }, {});
  }

  function countDelimiterOccurrences(line, delimiter) {
    let count = 0;
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];

      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (!quoted && character === delimiter) {
        count += 1;
      }
    }

    return count;
  }

  function detectDelimitedTextSeparator(text) {
    const firstDataLine = String(text || '')
      .split(/\r?\n/)
      .find(line => line.trim());
    const delimiters = [',', '\t', ';'];

    if (!firstDataLine) {
      return ',';
    }

    return delimiters
      .map(delimiter => ({
        delimiter,
        count: countDelimiterOccurrences(firstDataLine, delimiter)
      }))
      .sort((left, right) => right.count - left.count)[0].delimiter;
  }

  function parseDelimitedTable(text, delimiter) {
    const source = String(text || '');
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];

      if (quoted) {
        if (character === '"') {
          if (source[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = false;
          }
        } else {
          cell += character;
        }
        continue;
      }

      if (character === '"') {
        quoted = true;
        continue;
      }

      if (character === delimiter) {
        row.push(cell);
        cell = '';
        continue;
      }

      if (character === '\r' || character === '\n') {
        if (character === '\r' && source[index + 1] === '\n') {
          index += 1;
        }
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += character;
    }

    row.push(cell);
    rows.push(row);

    return rows
      .map(items => items.map(normalizeImportText))
      .filter(items => items.some(Boolean));
  }

  function normalizeImportedCount(value) {
    const number = Number(normalizeImportText(value).replace(/,/g, ''));
    if (!Number.isFinite(number) || number < 0) {
      return 0;
    }

    return Math.floor(number);
  }

  function normalizeImportedRateText(value, presentCount, signupCount) {
    const text = normalizeImportText(value);

    if (text) {
      if (text.includes('%')) {
        return text;
      }

      const number = Number(text.replace(/,/g, ''));
      if (Number.isFinite(number)) {
        const percentage = number > 1 ? number : number * 100;
        return `${percentage.toFixed(2)}%`;
      }
    }

    if (signupCount > 0) {
      return `${((presentCount / signupCount) * 100).toFixed(2)}%`;
    }

    return '0.00%';
  }

  function getImportedRowValue(row, headerIndex, fieldName) {
    const columnIndex = headerIndex[fieldName];
    return Number.isInteger(columnIndex) ? row[columnIndex] : '';
  }

  function buildImportedStatsRowsFromTable(tableRows = []) {
    const rows = tableRows
      .map(row => (Array.isArray(row) ? row.map(normalizeImportText) : []))
      .filter(row => row.some(Boolean));

    if (!rows.length) {
      return [];
    }

    const headerIndex = buildImportHeaderIndex(rows[0]);
    if (!Number.isInteger(headerIndex.participantName)) {
      return [];
    }

    return rows.slice(1)
      .map(row => {
        const signupCount = normalizeImportedCount(getImportedRowValue(row, headerIndex, 'signupCount'));
        const presentCount = normalizeImportedCount(getImportedRowValue(row, headerIndex, 'presentCount'));
        const absentCount = normalizeImportedCount(getImportedRowValue(row, headerIndex, 'absentCount'));

        return {
          participantName: normalizeImportText(getImportedRowValue(row, headerIndex, 'participantName')),
          managerAlias: normalizeImportText(getImportedRowValue(row, headerIndex, 'managerAlias')),
          signupCount,
          presentCount,
          absentCount,
          attendanceRateText: normalizeImportedRateText(
            getImportedRowValue(row, headerIndex, 'attendanceRateText'),
            presentCount,
            signupCount
          )
        };
      })
      .filter(row => row.participantName || row.signupCount || row.presentCount || row.absentCount);
  }

  function buildImportedStatsRowsFromText(text) {
    const delimiter = detectDelimitedTextSeparator(text);
    return buildImportedStatsRowsFromTable(parseDelimitedTable(text, delimiter));
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

  function getLogOperatorName(log) {
    return String(
      log.operatorName ||
      log.operatorDisplayName ||
      log.operatorPreferredName ||
      log.operatorManagerAlias ||
      ''
    ).trim();
  }

  function getLogOperatorDisplayName(log, targetDisplayName) {
    const operatorName = getLogOperatorName(log);
    const operatorOpenId = String(log.operatorOpenId || '').trim();
    const targetOpenId = String(log.targetOpenId || log.userOpenId || '').trim();

    if (operatorName) {
      return operatorName;
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

    return log.action || '';
  }

  function buildActivityLogRows(items = []) {
    return items.map(log => {
      const targetDisplayName = getLogTargetDisplayName(log);
      const operatorName = getLogOperatorName(log);

      return {
        id: log._id || log.id || '',
        type: log.action || '',
        operatorOpenId: log.operatorOpenId || '',
        operatorName,
        operatorDisplayName: getLogOperatorDisplayName(log, targetDisplayName),
        targetOpenId: log.targetOpenId || log.userOpenId || '',
        targetName: getLogTargetName(log),
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
      type: log.notificationType || log.type || '',
      operatorOpenId: log.operatorOpenId || '',
      targetOpenId: log.targetOpenId || log.userOpenId || '',
      status: log.status || '',
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
    formatBeijingDateTime,
    buildImportedStatsRowsFromTable,
    buildImportedStatsRowsFromText,
    buildNotificationLogRows,
    buildRosterRows,
    buildStatsRows,
    rowsToCsv
  };
});
