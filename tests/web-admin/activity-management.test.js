const {
  buildActivityRows,
  buildActivitySearchParams,
  buildActivityLogRows,
  buildAttendanceRows,
  formatBeijingDateTime,
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
      organizerKeyword: ' Coach Zhang ',
      startAtFrom: '2026-06-01',
      startAtTo: '2026-06-30',
      limit: '50',
      skip: '0'
    })
  ).toEqual({
    scope: 'web-admin',
    keyword: 'Friday',
    status: 'published',
    organizerKeyword: 'Coach Zhang',
    organizerOpenId: '',
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
        activityType: 'external',
        organizerOpenId: 'openid_owner',
        organizerName: 'Owner Zhang',
        organizerManagerAlias: 'Coach Zhang',
        joinedCount: 12,
        signupLimitTotal: 24
      }
    ])
  ).toEqual([
    {
      activityId: 'activity_1',
      title: 'Friday Football',
      startAt: '2026-06-06 04:00',
      status: 'published',
      confirmStatus: 'pending',
      activityType: 'external',
      activityTypeText: '外战',
      statusText: 'published',
      canConfirmProceeding: true,
      organizerOpenId: 'openid_owner',
      organizerName: 'Owner Zhang',
      organizerManagerAlias: 'Coach Zhang',
      organizerDisplayName: 'Coach Zhang',
      joinedCount: 12,
      signupLimitTotal: 24
    }
  ]);
});

test('buildActivityRows displays organizers as alias then name then openid', () => {
  expect(
    buildActivityRows([
      {
        _id: 'activity_alias',
        organizerOpenId: 'openid_alias',
        organizerName: 'Owner Zhang',
        organizerManagerAlias: 'Coach Zhang'
      },
      {
        _id: 'activity_name',
        organizerOpenId: 'openid_name',
        organizerName: 'Owner Li'
      },
      {
        _id: 'activity_openid',
        organizerOpenId: 'openid_only'
      }
    ]).map(row => row.organizerDisplayName)
  ).toEqual(['Coach Zhang', 'Owner Li', 'openid_only']);
});

test('buildActivityRows treats missing activity type as internal', () => {
  expect(
    buildActivityRows([
      {
        _id: 'activity_old',
        title: 'Historical Match'
      }
    ])[0]
  ).toMatchObject({
    activityType: 'internal',
    activityTypeText: '内战'
  });
});

test('formatBeijingDateTime renders timestamps in Beijing time', () => {
  expect(formatBeijingDateTime('2026-06-10T12:00:00.000Z')).toBe('2026-06-10 20:00');
  expect(formatBeijingDateTime('2026-12-31T18:30:00.000Z')).toBe('2027-01-01 02:30');
  expect(formatBeijingDateTime('')).toBe('');
  expect(formatBeijingDateTime('not-a-date')).toBe('not-a-date');
});

test('buildRosterRows flattens team members with manager aliases and attendance', () => {
  const rows = buildRosterRows({
    activity: {
      activityType: 'external'
    },
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
            avatarUrl: 'cloud://test-env/activity-avatars/player.jpg',
            preferredPositions: ['forward', 'goalkeeper'],
            proxyRegistration: false,
            attendanceStatus: 'present',
            performanceDescription: 'Pressed high'
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
      activityType: 'external',
      activityTypeText: '外战',
      registrationId: 'reg_1',
      userOpenId: 'openid_player',
      signupName: 'Alex',
      managerAlias: 'Zhang San',
      avatarUrl: 'cloud://test-env/activity-avatars/player.jpg',
      preferredPositions: 'forward / goalkeeper',
      proxyRegistration: false,
      attendanceStatus: 'present',
      performanceDescription: 'Pressed high'
    },
    {
      teamId: 'team_white',
      teamName: 'White',
      activityType: 'external',
      activityTypeText: '外战',
      registrationId: 'reg_2',
      userOpenId: 'proxy_1',
      signupName: 'Guest',
      managerAlias: '',
      avatarUrl: '',
      preferredPositions: '',
      proxyRegistration: true,
      attendanceStatus: 'absent',
      performanceDescription: ''
    }
  ]);
});

test('buildRosterRows defaults missing activity type to internal for roster export', () => {
  expect(
    buildRosterRows({
      teams: [
        {
          _id: 'team_white',
          teamName: 'White',
          members: [
            {
              registrationId: 'reg_1',
              userOpenId: 'openid_player',
              signupName: 'Alex'
            }
          ]
        }
      ]
    })[0]
  ).toMatchObject({
    activityType: 'internal',
    activityTypeText: '内战'
  });
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
        attendanceRate: 0.5,
        details: [
          {
            activityTitle: 'Sunday Match',
            teamName: 'White',
            signupName: 'Alex',
            managerAlias: 'Left foot',
            attendanceStatus: 'absent',
            startAt: '2026-06-10T12:00:00.000Z'
          }
        ]
      }
    ])
  ).toEqual([
    {
      participantName: 'Alex',
      managerAlias: 'Left foot',
      signupCount: 2,
      presentCount: 1,
      absentCount: 1,
      attendanceRateText: '50.00%',
      details: [
        {
          activityId: '',
          activityTitle: 'Sunday Match',
          teamName: 'White',
          signupName: 'Alex',
          managerAlias: 'Left foot',
          attendanceStatus: 'absent',
          startAt: '2026-06-10 20:00'
        }
      ]
    }
  ]);

  expect(
    buildActivityLogRows([
      {
        _id: 'log_1',
        activityId: 'activity_1',
        activityTitle: 'Sunday Match',
        action: 'attendance_update',
        operatorOpenId: 'openid_admin',
        operatorName: 'Admin Zhang',
        operatorManagerAlias: 'Captain',
        targetOpenId: 'openid_player',
        targetName: 'Alex',
        targetManagerAlias: 'Left foot',
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
      activityId: 'activity_1',
      activityTitle: 'Sunday Match',
      type: 'attendance_update',
      operatorOpenId: 'openid_admin',
      operatorName: 'Admin Zhang',
      operatorManagerAlias: 'Captain',
      operatorDisplayName: 'Captain',
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      targetManagerAlias: 'Left foot',
      targetDisplayName: 'Left foot',
      summary: 'Left foot 标记为缺勤',
      status: '',
      createdAt: '2026-06-10 18:00'
    },
    {
      id: 'log_2',
      activityId: '',
      activityTitle: '',
      type: 'registration_moved',
      operatorOpenId: 'openid_admin',
      operatorName: '',
      operatorManagerAlias: '',
      operatorDisplayName: 'openid_admin',
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      targetManagerAlias: '',
      targetDisplayName: 'Alex',
      summary: 'Alex 从 Red 换到 Green',
      status: '',
      createdAt: '2026-06-10 19:00'
    },
    {
      id: 'log_3',
      activityId: '',
      activityTitle: '',
      type: 'manager_alias_update',
      operatorOpenId: 'openid_admin',
      operatorName: '',
      operatorManagerAlias: '',
      operatorDisplayName: 'openid_admin',
      targetOpenId: 'openid_player',
      targetName: 'Alex',
      targetManagerAlias: '',
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
        activityId: 'activity_1',
        activityTitle: '周五足球',
        notificationType: 'cancelled',
        targetOpenId: 'openid_player',
        status: 'failed',
        errorMessage: 'quota exceeded',
        createdAt: '2026-06-10T11:00:00.000Z'
      }
    ])
  ).toEqual([
    {
      id: 'notice_1',
      activityId: 'activity_1',
      activityTitle: '周五足球',
      type: 'cancelled',
      operatorOpenId: '',
      targetOpenId: 'openid_player',
      status: 'failed',
      errorMessage: 'quota exceeded',
      createdAt: '2026-06-10 19:00'
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
