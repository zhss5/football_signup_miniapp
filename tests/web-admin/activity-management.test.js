const {
  buildActivityRows,
  buildActivitySearchParams,
  buildActivityLogRows,
  buildAttendanceRows,
  formatBeijingDateTime,
  buildNotificationLogRows,
  buildRosterRows,
  buildImportedStatsRowsFromTable,
  buildImportedStatsRowsFromText,
  buildStatsRows,
  rowsToCsv
} = require('../../web-admin/src/activity-management');

test('buildActivitySearchParams keeps listActivities filters API-shaped', () => {
  expect(
    buildActivitySearchParams({
      keyword: ' Friday ',
      status: 'published',
      organizerOpenId: ' openid_owner ',
      startAtFrom: '2026-06-01',
      startAtTo: '2026-06-30',
      limit: '50',
      skip: '0'
    })
  ).toEqual({
    scope: 'web-admin',
    keyword: 'Friday',
    status: 'published',
    organizerOpenId: 'openid_owner',
    startAtFrom: '2026-06-01',
    startAtTo: '2026-06-30',
    limit: 50,
    skip: 0
  });
});

test('buildActivityRows exposes operations-friendly activity metadata', () => {
  expect(
    buildActivityRows([
      {
        _id: 'activity_1',
        title: 'Friday Football',
        startAt: '2026-06-05T20:00:00.000Z',
        status: 'published',
        confirmStatus: 'pending',
        organizerOpenId: 'openid_owner',
        joinedCount: 12
      }
    ])
  ).toEqual([
    {
      activityId: 'activity_1',
      title: 'Friday Football',
      startAt: '2026-06-06 04:00',
      status: 'published',
      confirmStatus: 'pending',
      statusText: 'published / pending',
      canConfirmProceeding: true,
      organizerOpenId: 'openid_owner',
      joinedCount: 12
    }
  ]);
});

test('formatBeijingDateTime renders timestamps in Beijing time', () => {
  expect(formatBeijingDateTime('2026-06-10T12:00:00.000Z')).toBe('2026-06-10 20:00');
  expect(formatBeijingDateTime('2026-12-31T18:30:00.000Z')).toBe('2027-01-01 02:30');
  expect(formatBeijingDateTime('')).toBe('');
  expect(formatBeijingDateTime('not-a-date')).toBe('not-a-date');
});

test('buildRosterRows flattens team members with manager aliases and attendance', () => {
  const rows = buildRosterRows({
    teams: [
      {
        _id: 'team_white',
        teamName: 'White',
        members: [
          {
            registrationId: 'reg_1',
            userOpenId: 'openid_player',
            signupName: 'Alex',
            managerAlias: 'Zhang San',
            preferredPositions: ['forward', 'goalkeeper'],
            proxyRegistration: false,
            attendanceStatus: 'present'
          },
          {
            registrationId: 'reg_2',
            userOpenId: 'proxy_1',
            signupName: 'Guest',
            preferredPositions: [],
            proxyRegistration: true,
            attendanceStatus: 'absent'
          }
        ]
      }
    ]
  });

  expect(rows).toEqual([
    {
      teamId: 'team_white',
      teamName: 'White',
      registrationId: 'reg_1',
      userOpenId: 'openid_player',
      signupName: 'Alex',
      managerAlias: 'Zhang San',
      preferredPositions: 'forward / goalkeeper',
      proxyRegistration: false,
      attendanceStatus: 'present'
    },
    {
      teamId: 'team_white',
      teamName: 'White',
      registrationId: 'reg_2',
      userOpenId: 'proxy_1',
      signupName: 'Guest',
      managerAlias: '',
      preferredPositions: '',
      proxyRegistration: true,
      attendanceStatus: 'absent'
    }
  ]);
});

test('rowsToCsv produces browser-downloadable CSV text with escaped fields', () => {
  expect(
    rowsToCsv([
      {
        teamName: 'White',
        signupName: 'Alex, Jr',
        attendanceStatus: 'present'
      }
    ])
  ).toBe('teamName,signupName,attendanceStatus\r\nWhite,"Alex, Jr",present');
});

test('stats and log row builders keep stable display fields', () => {
  expect(
    buildStatsRows([
      {
        participantName: 'Alex',
        managerAlias: 'Left foot',
        signupCount: 2,
        presentCount: 1,
        absentCount: 1,
        attendanceRate: 0.5
      }
    ])
  ).toEqual([
    {
      participantName: 'Alex',
      managerAlias: 'Left foot',
      signupCount: 2,
      presentCount: 1,
      absentCount: 1,
      attendanceRateText: '50.00%'
    }
  ]);

  expect(
    buildActivityLogRows([
      {
        _id: 'log_1',
        action: 'attendance_update',
        operatorOpenId: 'openid_admin',
        operatorName: '管理员张',
        targetOpenId: 'openid_player',
        targetName: 'Alex',
        attendanceStatus: 'absent',
        createdAt: '2026-06-10T10:00:00.000Z'
      },
      {
        _id: 'log_2',
        action: 'registration_moved',
        operatorOpenId: 'openid_admin',
        targetOpenId: 'openid_player',
        targetName: 'Alex',
        fromTeamName: 'Red',
        toTeamName: 'Green',
        createdAt: '2026-06-10T11:00:00.000Z'
      },
      {
        _id: 'log_3',
        action: 'manager_alias_update',
        operatorOpenId: 'openid_admin',
        targetOpenId: 'openid_player',
        targetName: 'Alex',
        before: { managerAlias: 'Old' },
        after: { managerAlias: 'New' },
        createdAt: '2026-06-10T12:00:00.000Z'
      }
    ])
  ).toEqual([
    {
      id: 'log_1',
      type: 'attendance_update',
      operatorOpenId: 'openid_admin',
      operatorName: '管理员张',
      operatorDisplayName: '管理员张',
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      targetDisplayName: 'Alex',
      summary: 'Alex 标记为缺勤',
      status: '',
      createdAt: '2026-06-10 18:00'
    },
    {
      id: 'log_2',
      type: 'registration_moved',
      operatorOpenId: 'openid_admin',
      operatorName: '',
      operatorDisplayName: 'openid_admin',
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      targetDisplayName: 'Alex',
      summary: 'Alex 从 Red 换到 Green',
      status: '',
      createdAt: '2026-06-10 19:00'
    },
    {
      id: 'log_3',
      type: 'manager_alias_update',
      operatorOpenId: 'openid_admin',
      operatorName: '',
      operatorDisplayName: 'openid_admin',
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      targetDisplayName: 'Alex',
      summary: 'Alex 备注从 Old 改为 New',
      status: '',
      createdAt: '2026-06-10 20:00'
    }
  ]);

  expect(
    buildNotificationLogRows([
      {
        _id: 'notice_1',
        notificationType: 'cancelled',
        targetOpenId: 'openid_player',
        status: 'failed',
        createdAt: '2026-06-10T11:00:00.000Z'
      }
    ])
  ).toEqual([
    {
      id: 'notice_1',
      type: 'cancelled',
      operatorOpenId: '',
      targetOpenId: 'openid_player',
      status: 'failed',
      createdAt: '2026-06-10 19:00'
    }
  ]);
});

test('buildImportedStatsRowsFromText maps Chinese CSV attendance columns', () => {
  expect(
    buildImportedStatsRowsFromText(
      '参与者,备注,报名次数,出勤,缺勤,出勤率\n张虹生,酱油2,3,2,1,66.67%\n人员1,,1,1,0,100%'
    )
  ).toEqual([
    {
      participantName: '张虹生',
      managerAlias: '酱油2',
      signupCount: 3,
      presentCount: 2,
      absentCount: 1,
      attendanceRateText: '66.67%'
    },
    {
      participantName: '人员1',
      managerAlias: '',
      signupCount: 1,
      presentCount: 1,
      absentCount: 0,
      attendanceRateText: '100%'
    }
  ]);
});

test('buildImportedStatsRowsFromTable maps Excel-style attendance rows', () => {
  expect(
    buildImportedStatsRowsFromTable([
      ['报名人', '备注', '报名数', '出勤次数', '缺勤次数'],
      ['张虹生', '酱油2', '2', '1', '1'],
      ['人员1', '', 1, 1, 0]
    ])
  ).toEqual([
    {
      participantName: '张虹生',
      managerAlias: '酱油2',
      signupCount: 2,
      presentCount: 1,
      absentCount: 1,
      attendanceRateText: '50.00%'
    },
    {
      participantName: '人员1',
      managerAlias: '',
      signupCount: 1,
      presentCount: 1,
      absentCount: 0,
      attendanceRateText: '100.00%'
    }
  ]);
});

test('buildAttendanceRows creates explicit attendance mutation options', () => {
  expect(
    buildAttendanceRows([
      {
        registrationId: 'reg_1',
        attendanceStatus: 'present'
      }
    ])
  ).toEqual([
    {
      registrationId: 'reg_1',
      attendanceStatus: 'present',
      nextAttendanceStatus: 'absent'
    }
  ]);
});
