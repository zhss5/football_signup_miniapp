const exportActivityRoster = require('../../cloudfunctions/exportActivityRoster/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
      openid_other_owner: { _id: 'openid_other_owner', roles: ['user', 'organizer'] },
      openid_admin: { _id: 'openid_admin', roles: ['user', 'admin'] },
      openid_super: { _id: 'openid_super', roles: ['user', 'super_admin'] },
      openid_regular: { _id: 'openid_regular', roles: ['user'] },
      openid_alex: {
        _id: 'openid_alex',
        roles: ['user'],
        managerAlias: 'Zhang San'
      },
      openid_ben: {
        _id: 'openid_ben',
        roles: ['user'],
        managerAlias: ''
      },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Sunday Match',
        organizerOpenId: 'openid_owner',
        status: 'published'
      },
      activity_other: {
        _id: 'activity_other',
        title: 'Other Match',
        organizerOpenId: 'openid_other_owner',
        status: 'published'
      },
      ...(options.activities || {})
    },
    activity_teams: {
      team_green: {
        _id: 'team_green',
        activityId: 'activity_1',
        teamName: 'Green',
        sort: 0,
        status: 'active'
      },
      team_red: {
        _id: 'team_red',
        activityId: 'activity_1',
        teamName: 'Red',
        sort: 1,
        status: 'active'
      },
      team_other: {
        _id: 'team_other',
        activityId: 'activity_other',
        teamName: 'Other',
        sort: 0,
        status: 'active'
      },
      ...(options.teams || {})
    },
    registrations: {
      reg_alex: {
        _id: 'reg_alex',
        activityId: 'activity_1',
        teamId: 'team_green',
        userOpenId: 'openid_alex',
        status: 'joined',
        signupName: 'Alex',
        preferredPositions: ['Forward', 'Midfield'],
        proxyRegistration: false,
        attendanceStatus: 'absent',
        performanceDescription: 'Strong pressing',
        joinedAt: '2026-06-01T10:00:00.000Z'
      },
      reg_ben: {
        _id: 'reg_ben',
        activityId: 'activity_1',
        teamId: 'team_red',
        userOpenId: 'openid_ben',
        status: 'joined',
        signupName: 'Ben',
        preferredPositions: ['Goalkeeper'],
        joinedAt: '2026-06-01T10:05:00.000Z'
      },
      reg_cancelled: {
        _id: 'reg_cancelled',
        activityId: 'activity_1',
        teamId: 'team_green',
        userOpenId: 'openid_cancelled',
        status: 'cancelled',
        signupName: 'Cancelled',
        joinedAt: '2026-06-01T10:10:00.000Z'
      },
      reg_other: {
        _id: 'reg_other',
        activityId: 'activity_other',
        teamId: 'team_other',
        userOpenId: 'openid_alex',
        status: 'joined',
        signupName: 'Alex Other',
        joinedAt: '2026-06-02T10:00:00.000Z'
      },
      ...(options.registrations || {})
    }
  };

  return {
    state,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              return { data: state[name][id] || null };
            }
          };
        },
        async get() {
          return { data: Object.values(state[name] || {}) };
        }
      };
    }
  };
}

test('organizer can export roster rows grouped by team', async () => {
  const db = createFakeDb();

  const result = await exportActivityRoster.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(result.rows.map(row => row.teamName)).toEqual(['Green', 'Red']);
  expect(result.rows.map(row => row.participantName)).toEqual(['Alex', 'Ben']);
  expect(result.rows).toHaveLength(2);
});

test('admin can export another organizer activity roster', async () => {
  const db = createFakeDb();

  const result = await exportActivityRoster.main(
    { activityId: 'activity_other' },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(result.rows).toEqual([
    expect.objectContaining({
      activityTitle: 'Other Match',
      teamName: 'Other',
      participantName: 'Alex Other'
    })
  ]);
});

test('super admin can export another organizer activity roster', async () => {
  const db = createFakeDb();

  const result = await exportActivityRoster.main(
    { activityId: 'activity_other' },
    { OPENID: 'openid_super' },
    { db }
  );

  expect(result.rows).toHaveLength(1);
});

test('regular user cannot export roster rows', async () => {
  const db = createFakeDb();

  await expect(
    exportActivityRoster.main({ activityId: 'activity_1' }, { OPENID: 'openid_regular' }, { db })
  ).rejects.toThrow('Only the organizer or an admin can export rosters');
});

test('export rows include manager alias preferred positions proxy flag and attendance status', async () => {
  const db = createFakeDb({
    registrations: {
      reg_proxy: {
        _id: 'reg_proxy',
        activityId: 'activity_1',
        teamId: 'team_green',
        userOpenId: 'proxy_activity_1_1',
        status: 'joined',
        signupName: 'Guest',
        preferredPositions: ['Defender'],
        proxyRegistration: true,
        performanceDescription: 'Filled in at the back',
        joinedAt: '2026-06-01T10:03:00.000Z'
      }
    }
  });

  const result = await exportActivityRoster.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(result.rows).toEqual([
    {
      activityId: 'activity_1',
      activityTitle: 'Sunday Match',
      activityType: 'internal',
      activityTypeLabel: '内战',
      teamId: 'team_green',
      teamName: 'Green',
      registrationId: 'reg_alex',
      userOpenId: 'openid_alex',
      participantName: 'Alex',
      managerAlias: 'Zhang San',
      preferredPositions: ['Forward', 'Midfield'],
      proxyRegistration: false,
      attendanceStatus: 'absent',
      performanceDescription: 'Strong pressing'
    },
    {
      activityId: 'activity_1',
      activityTitle: 'Sunday Match',
      activityType: 'internal',
      activityTypeLabel: '内战',
      teamId: 'team_green',
      teamName: 'Green',
      registrationId: 'reg_proxy',
      userOpenId: 'proxy_activity_1_1',
      participantName: 'Guest',
      managerAlias: '',
      preferredPositions: ['Defender'],
      proxyRegistration: true,
      attendanceStatus: 'present',
      performanceDescription: 'Filled in at the back'
    },
    {
      activityId: 'activity_1',
      activityTitle: 'Sunday Match',
      activityType: 'internal',
      activityTypeLabel: '内战',
      teamId: 'team_red',
      teamName: 'Red',
      registrationId: 'reg_ben',
      userOpenId: 'openid_ben',
      participantName: 'Ben',
      managerAlias: '',
      preferredPositions: ['Goalkeeper'],
      proxyRegistration: false,
      attendanceStatus: 'present',
      performanceDescription: ''
    }
  ]);
});

test('export rows include activity type and default historical activities to internal', async () => {
  const db = createFakeDb({
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Sunday Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        activityType: 'external'
      },
      activity_legacy: {
        _id: 'activity_legacy',
        title: 'Legacy Match',
        organizerOpenId: 'openid_owner',
        status: 'published'
      }
    },
    teams: {
      team_legacy: {
        _id: 'team_legacy',
        activityId: 'activity_legacy',
        teamName: 'Legacy',
        sort: 0,
        status: 'active'
      }
    },
    registrations: {
      reg_legacy: {
        _id: 'reg_legacy',
        activityId: 'activity_legacy',
        teamId: 'team_legacy',
        userOpenId: 'openid_ben',
        status: 'joined',
        signupName: 'Legacy Ben',
        joinedAt: '2026-06-03T10:00:00.000Z'
      }
    }
  });

  const externalResult = await exportActivityRoster.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db }
  );
  const legacyResult = await exportActivityRoster.main(
    { activityId: 'activity_legacy' },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(externalResult.rows[0]).toMatchObject({
    activityType: 'external',
    activityTypeLabel: '外战'
  });
  expect(legacyResult.rows[0]).toMatchObject({
    activityType: 'internal',
    activityTypeLabel: '内战'
  });
});
