const {
  DEFAULT_MEMBER_AVATAR_TEXT,
  buildActivityCardVm,
  buildTeamListVm
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
    joinButtonText: 'Joined'
  });
  expect(teams[1]).toMatchObject({
    joinDisabled: true,
    joinButtonText: 'Joined'
  });
  expect(teams[0].members[0]).toMatchObject({
    signupName: 'Alex',
    avatarText: 'A'
  });
  expect(DEFAULT_MEMBER_AVATAR_TEXT).toBe('#');
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
    memberActionText: 'Remove'
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
