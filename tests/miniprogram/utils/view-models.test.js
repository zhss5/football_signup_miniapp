const {
  DEFAULT_MEMBER_AVATAR_TEXT,
  buildActivityCardVm,
  buildTeamListVm,
  getActivitySignupState
} = require('../../../miniprogram/utils/formatters');
const { t } = require('../../../miniprogram/utils/i18n');

test('buildActivityCardVm marks full activities', () => {
  const vm = buildActivityCardVm({
    title: 'Saturday 8-10',
    joinedCount: 12,
    signupLimitTotal: 12,
    status: 'published'
  });

  expect(vm.statusText).toBe('Full');
});

test('buildActivityCardVm exposes a highlighted tone for joinable status and gray tone for disabled status', () => {
  const joinableVm = buildActivityCardVm({
    title: 'Saturday 8-10',
    joinedCount: 3,
    signupLimitTotal: 12,
    status: 'published'
  });
  const fullVm = buildActivityCardVm({
    title: 'Saturday 8-10',
    joinedCount: 12,
    signupLimitTotal: 12,
    status: 'published'
  });

  expect(joinableVm.statusTone).toBe('joinable');
  expect(fullVm.statusTone).toBe('disabled');
});

test('buildActivityCardVm can localize status and capacity text to Chinese', () => {
  const vm = buildActivityCardVm(
    {
      title: 'Saturday 8-10',
      joinedCount: 3,
      signupLimitTotal: 12,
      status: 'published'
    },
    undefined,
    (key, params) => t(key, params, 'zh-CN')
  );

  expect(vm.statusText).toBe('可报名');
  expect(vm.capacityText).toBe('已报名 3 / 12');
});

test('buildActivityCardVm marks activities past signup deadline as closed and exposes start and capacity labels', () => {
  const vm = buildActivityCardVm(
    {
      title: 'Saturday 8-10',
      joinedCount: 3,
      signupLimitTotal: 12,
      status: 'published',
      startAt: '2026-04-26T12:00:00.000Z',
      signupDeadlineAt: '2026-04-26T11:00:00.000Z'
    },
    () => new Date('2026-04-26T12:30:00.000Z').getTime()
  );

  expect(vm.statusText).toBe('Signup Closed');
  expect(vm.capacityText).toBe('Joined 3 / 12');
  expect(vm.startDisplayText).toBeTruthy();
});

test('getActivitySignupState exposes a stable signup closed state key', () => {
  const state = getActivitySignupState(
    {
      joinedCount: 3,
      signupLimitTotal: 12,
      status: 'published',
      signupDeadlineAt: '2026-04-26T11:00:00.000Z'
    },
    () => new Date('2026-04-26T12:30:00.000Z').getTime()
  );

  expect(state).toMatchObject({
    statusText: 'Signup Closed',
    joinEnabled: false,
    stateKey: 'signupClosed'
  });
});

test('buildActivityCardVm marks published activities after the end time as expired', () => {
  const vm = buildActivityCardVm(
    {
      title: 'Saturday 8-10',
      joinedCount: 3,
      signupLimitTotal: 12,
      status: 'published',
      endAt: '2026-04-26T14:00:00.000Z',
      signupDeadlineAt: '2026-04-26T11:00:00.000Z'
    },
    () => new Date('2026-04-26T14:30:00.000Z').getTime()
  );

  expect(vm.statusText).toBe('Expired');
  expect(vm.statusTone).toBe('expired');
});

test('buildActivityCardVm marks deleted activities and hides organizer actions', () => {
  const vm = buildActivityCardVm({
    title: 'Saturday 8-10',
    joinedCount: 0,
    signupLimitTotal: 12,
    status: 'deleted'
  });

  expect(vm.statusText).toBe('Deleted');
  expect(vm.canCancelActivity).toBe(false);
  expect(vm.canDeleteActivity).toBe(false);
});

test('buildTeamListVm disables all join buttons after signup and prepares member avatars', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_white',
        teamName: 'White',
        joinedCount: 1,
        maxMembers: 6,
        members: [{ signupName: 'Alex', avatarUrl: '' }]
      },
      {
        _id: 'team_red',
        teamName: 'Red',
        joinedCount: 0,
        maxMembers: 6,
        members: []
      }
    ],
    {
      teamId: 'team_white',
      status: 'joined'
    }
  );

  expect(teams[0]).toMatchObject({
    joinDisabled: true,
    joinButtonText: 'Joined',
    joinActionVisible: false,
    joinActionText: ''
  });
  expect(teams[1]).toMatchObject({
    joinDisabled: true,
    joinButtonText: 'Joined',
    joinActionVisible: false,
    joinActionText: ''
  });
  expect(teams[0].members[0]).toMatchObject({
    signupName: 'Alex',
    avatarText: 'A'
  });
  expect(DEFAULT_MEMBER_AVATAR_TEXT).toBe('#');
});

test('buildTeamListVm exposes a compact join action only while a team can be joined', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_red',
        teamName: 'Red',
        joinedCount: 0,
        maxMembers: 6,
        members: []
      },
      {
        _id: 'team_blue',
        teamName: 'Blue',
        joinedCount: 6,
        maxMembers: 6,
        members: []
      }
    ],
    null,
    {
      status: 'published'
    }
  );

  expect(teams[0]).toMatchObject({
    joinActionVisible: true,
    joinActionText: 'Join'
  });
  expect(teams[1]).toMatchObject({
    joinActionVisible: false,
    joinActionText: ''
  });
});

test('buildTeamListVm exposes team color display fields with fallback by sort order', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_one',
        teamName: 'Team 1',
        sort: 0,
        colorKey: 'green',
        joinedCount: 0,
        maxMembers: 12,
        members: []
      },
      {
        _id: 'team_two',
        teamName: 'Team 2',
        sort: 1,
        joinedCount: 0,
        maxMembers: 12,
        members: []
      }
    ],
    null,
    { status: 'published' }
  );

  expect(teams[0]).toMatchObject({
    teamColorKey: 'green',
    teamColorClass: 'team-color-green'
  });
  expect(teams[1]).toMatchObject({
    teamColorKey: 'white',
    teamColorClass: 'team-color-white'
  });
});

test('buildTeamListVm exposes team color editing only when allowed', () => {
  const teams = [
    {
      _id: 'team_one',
      teamName: 'Team 1',
      joinedCount: 0,
      maxMembers: 12,
      members: []
    }
  ];
  const regularVm = buildTeamListVm(teams, null, { status: 'published' });
  const managerVm = buildTeamListVm(
    teams,
    null,
    { status: 'published' },
    undefined,
    undefined,
    {
      canEditTeamColor: true
    }
  );

  expect(regularVm[0].canEditColor).toBe(false);
  expect(managerVm[0].canEditColor).toBe(true);
});

test('buildTeamListVm marks the current user member row with cancel signup action', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_red',
        teamName: 'Red',
        joinedCount: 1,
        maxMembers: 6,
        members: [
          {
            userOpenId: 'openid_self',
            signupName: 'Alex',
            avatarUrl: ''
          }
        ]
      }
    ],
    {
      teamId: 'team_red',
      status: 'joined',
      userOpenId: 'openid_self'
    },
    {
      status: 'published'
    },
    undefined,
    undefined,
    {
      canCancelSignup: true
    }
  );

  expect(teams[0].members[0]).toMatchObject({
    userOpenId: 'openid_self',
    isCurrentUser: true,
    memberAction: 'cancelSignup',
    memberActionText: 'Cancel Signup'
  });
});

test('buildTeamListVm marks other member rows with remove action for managers', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_red',
        teamName: 'Red',
        joinedCount: 2,
        maxMembers: 6,
        members: [
          {
            userOpenId: 'openid_self',
            signupName: 'Alex',
            avatarUrl: ''
          },
          {
            userOpenId: 'openid_other',
            signupName: 'Bob',
            avatarUrl: ''
          }
        ]
      }
    ],
    {
      teamId: 'team_red',
      status: 'joined',
      userOpenId: 'openid_self'
    },
    {
      status: 'published'
    },
    undefined,
    undefined,
    {
      canCancelSignup: true,
      canManageRegistrations: true
    }
  );

  expect(teams[0].members[0]).toMatchObject({
    isCurrentUser: true,
    memberAction: 'cancelSignup'
  });
  expect(teams[0].members[1]).toMatchObject({
    isCurrentUser: false,
    memberAction: 'remove',
    memberActionText: 'Remove',
    moveActionVisible: true,
    moveActionText: 'Move'
  });
});

test('buildTeamListVm hides move actions from regular users', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_red',
        teamName: 'Red',
        joinedCount: 1,
        maxMembers: 6,
        members: [
          {
            userOpenId: 'openid_other',
            signupName: 'Bob',
            avatarUrl: ''
          }
        ]
      }
    ],
    null,
    {
      status: 'published'
    }
  );

  expect(teams[0].members[0]).toMatchObject({
    moveActionVisible: false,
    moveActionText: ''
  });
});

test('buildTeamListVm enables proxy signup for managers while signup is open', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_red',
        teamName: 'Red',
        joinedCount: 1,
        maxMembers: 6,
        members: []
      }
    ],
    {
      teamId: 'team_red',
      status: 'joined',
      userOpenId: 'openid_self'
    },
    {
      status: 'published'
    },
    undefined,
    undefined,
    {
      canManageRegistrations: true
    }
  );

  expect(teams[0]).toMatchObject({
    canProxySignup: true,
    proxySignupText: 'Add participant'
  });
});

test('buildTeamListVm marks proxy members for managers only', () => {
  const teams = [
    {
      _id: 'team_red',
      teamName: 'Red',
      joinedCount: 1,
      maxMembers: 6,
      members: [
        {
          userOpenId: 'proxy_1',
          signupName: 'Guest Player',
          avatarUrl: '',
          proxyRegistration: true
        }
      ]
    }
  ];
  const activity = {
    status: 'published'
  };

  const managerVm = buildTeamListVm(teams, null, activity, undefined, undefined, {
    canManageRegistrations: true
  });
  const regularVm = buildTeamListVm(teams, null, activity);

  expect(managerVm[0].members[0]).toMatchObject({
    proxyBadgeVisible: true,
    proxyBadgeText: 'Proxy'
  });
  expect(regularVm[0].members[0]).toMatchObject({
    proxyBadgeVisible: false,
    proxyBadgeText: ''
  });
});

test('buildTeamListVm exposes attendance actions for managers after an activity is confirmed', () => {
  const teams = [
    {
      _id: 'team_green',
      teamName: 'Green',
      joinedCount: 2,
      maxMembers: 6,
      members: [
        {
          registrationId: 'registration_present',
          userOpenId: 'openid_present',
          signupName: 'Alex',
          attendanceStatus: 'present'
        },
        {
          registrationId: 'registration_absent',
          userOpenId: 'openid_absent',
          signupName: 'Ben',
          attendanceStatus: 'absent'
        }
      ]
    }
  ];

  const vm = buildTeamListVm(
    teams,
    null,
    {
      status: 'published',
      confirmStatus: 'confirmed'
    },
    undefined,
    undefined,
    {
      canManageRegistrations: true
    }
  );

  expect(vm[0].members[0]).toMatchObject({
    attendanceStatusVisible: true,
    attendanceStatusText: 'Present',
    attendanceActionVisible: true,
    attendanceActionStatus: 'absent',
    attendanceActionText: 'Mark absent'
  });
  expect(vm[0].members[1]).toMatchObject({
    attendanceStatusVisible: true,
    attendanceStatusText: 'Absent',
    attendanceActionVisible: true,
    attendanceActionStatus: 'present',
    attendanceActionText: 'Mark present'
  });
});

test('buildTeamListVm hides attendance actions before confirmation and from regular users', () => {
  const teams = [
    {
      _id: 'team_green',
      teamName: 'Green',
      joinedCount: 1,
      maxMembers: 6,
      members: [
        {
          registrationId: 'registration_present',
          userOpenId: 'openid_present',
          signupName: 'Alex',
          attendanceStatus: 'present'
        }
      ]
    }
  ];

  const pendingManagerVm = buildTeamListVm(
    teams,
    null,
    {
      status: 'published',
      confirmStatus: 'pending'
    },
    undefined,
    undefined,
    {
      canManageRegistrations: true
    }
  );
  const regularVm = buildTeamListVm(teams, null, {
    status: 'published',
    confirmStatus: 'confirmed'
  });

  expect(pendingManagerVm[0].members[0]).toMatchObject({
    attendanceStatusVisible: false,
    attendanceActionVisible: false,
    attendanceActionText: ''
  });
  expect(regularVm[0].members[0]).toMatchObject({
    attendanceStatusVisible: false,
    attendanceActionVisible: false,
    attendanceActionText: ''
  });
});

test('buildTeamListVm shows preferred positions to regular users and managers', () => {
  const teams = [
    {
      _id: 'team_red',
      teamName: 'Red',
      joinedCount: 1,
      maxMembers: 6,
      members: [
        {
          userOpenId: 'openid_player',
          signupName: 'Alex',
          avatarUrl: '',
          preferredPositions: ['前锋', '门将']
        }
      ]
    }
  ];
  const activity = {
    status: 'published'
  };

  const managerVm = buildTeamListVm(teams, null, activity, undefined, undefined, {
    canManageRegistrations: true
  });
  const regularVm = buildTeamListVm(teams, null, activity);

  expect(managerVm[0].members[0]).toMatchObject({
    preferredPositionsVisible: true,
    preferredPositionsText: '前锋 / 门将'
  });
  expect(regularVm[0].members[0]).toMatchObject({
    preferredPositionsVisible: true,
    preferredPositionsText: managerVm[0].members[0].preferredPositionsText
  });
});

test('buildTeamListVm disables proxy signup for managers when the team is full', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_red',
        teamName: 'Red',
        joinedCount: 6,
        maxMembers: 6,
        members: []
      }
    ],
    null,
    {
      status: 'published'
    },
    undefined,
    undefined,
    {
      canManageRegistrations: true
    }
  );

  expect(teams[0]).toMatchObject({
    canProxySignup: false,
    proxySignupText: ''
  });
});

test('buildTeamListVm does not show remove action on the current user row', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_red',
        teamName: 'Red',
        joinedCount: 1,
        maxMembers: 6,
        members: [
          {
            userOpenId: 'openid_self',
            signupName: 'Alex',
            avatarUrl: ''
          }
        ]
      }
    ],
    {
      teamId: 'team_red',
      status: 'joined',
      userOpenId: 'openid_self'
    },
    {
      status: 'published'
    },
    undefined,
    undefined,
    {
      canCancelSignup: false,
      canManageRegistrations: true
    }
  );

  expect(teams[0].members[0]).toMatchObject({
    isCurrentUser: true,
    memberAction: '',
    memberActionText: ''
  });
});

test('buildTeamListVm disables join after signup deadline', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_white',
        teamName: 'White',
        joinedCount: 0,
        maxMembers: 6,
        members: []
      }
    ],
    null,
    {
      status: 'published',
      signupDeadlineAt: '2026-04-26T11:00:00.000Z'
    },
    () => new Date('2026-04-26T12:30:00.000Z').getTime()
  );

  expect(teams[0]).toMatchObject({
    joinDisabled: true,
    joinButtonText: 'Signup Closed'
  });
});

test('buildTeamListVm disables join after the activity end time', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_white',
        teamName: 'White',
        joinedCount: 0,
        maxMembers: 6,
        members: []
      }
    ],
    null,
    {
      status: 'published',
      endAt: '2026-04-26T14:00:00.000Z',
      signupDeadlineAt: '2026-04-26T11:00:00.000Z'
    },
    () => new Date('2026-04-26T14:30:00.000Z').getTime()
  );

  expect(teams[0]).toMatchObject({
    joinDisabled: true,
    joinButtonText: 'Expired'
  });
});

test('buildTeamListVm localizes join button states to Chinese', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_white',
        teamName: 'White',
        joinedCount: 0,
        maxMembers: 6,
        members: []
      }
    ],
    {
      teamId: 'team_white',
      status: 'joined'
    },
    {
      status: 'published'
    },
    undefined,
    (key, params) => t(key, params, 'zh-CN')
  );

  expect(teams[0]).toMatchObject({
    joinDisabled: true,
    joinButtonText: '已报名'
  });
});
