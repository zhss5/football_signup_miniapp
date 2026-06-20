const {
  buildActivityRows,
  buildActivitySearchParams,
  buildActivityLogRows,
  buildAttendanceRows,
  buildNotificationLogRows,
  buildRosterRows,
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
      startAt: '2026-06-05T20:00:00.000Z',
      status: 'published',
      confirmStatus: 'pending',
      statusText: 'published / pending',
      canConfirmProceeding: true,
      organizerOpenId: 'openid_owner',
      joinedCount: 12
    }
  ]);
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
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      summary: 'Alex 标记为缺勤',
      status: '',
      createdAt: '2026-06-10T10:00:00.000Z'
    },
    {
      id: 'log_2',
      type: 'registration_moved',
      operatorOpenId: 'openid_admin',
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      summary: 'Alex 从 Red 换到 Green',
      status: '',
      createdAt: '2026-06-10T11:00:00.000Z'
    },
    {
      id: 'log_3',
      type: 'manager_alias_update',
      operatorOpenId: 'openid_admin',
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      summary: 'Alex 备注从 Old 改为 New',
      status: '',
      createdAt: '2026-06-10T12:00:00.000Z'
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
      createdAt: '2026-06-10T11:00:00.000Z'
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
