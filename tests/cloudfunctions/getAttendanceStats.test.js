const getAttendanceStats = require('../../cloudfunctions/getAttendanceStats/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
      openid_other_owner: { _id: 'openid_other_owner', roles: ['user', 'organizer'] },
      openid_admin: { _id: 'openid_admin', roles: ['user', 'admin'] },
      openid_regular: { _id: 'openid_regular', roles: ['user'] },
      openid_alex: { _id: 'openid_alex', roles: ['user'], managerAlias: 'Left foot' },
      openid_ben: { _id: 'openid_ben', roles: ['user'], managerAlias: '' },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Confirmed Match 1',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'confirmed',
        startAt: '2026-05-01T12:00:00.000Z'
      },
      activity_2: {
        _id: 'activity_2',
        title: 'Confirmed Match 2',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'confirmed',
        startAt: '2026-05-08T12:00:00.000Z'
      },
      activity_other: {
        _id: 'activity_other',
        title: 'Other Organizer Match',
        organizerOpenId: 'openid_other_owner',
        status: 'published',
        confirmStatus: 'confirmed',
        startAt: '2026-05-08T12:00:00.000Z'
      },
      ...(options.activities || {})
    },
    registrations: {
      reg_1_alex: {
        _id: 'reg_1_alex',
        activityId: 'activity_1',
        userOpenId: 'openid_alex',
        signupName: 'Alex',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_2_alex: {
        _id: 'reg_2_alex',
        activityId: 'activity_2',
        userOpenId: 'openid_alex',
        signupName: 'Alex',
        status: 'joined',
        attendanceStatus: 'absent'
      },
      reg_1_ben_blank: {
        _id: 'reg_1_ben_blank',
        activityId: 'activity_1',
        userOpenId: 'openid_ben',
        signupName: 'Ben',
        status: 'joined'
      },
      reg_other_alex: {
        _id: 'reg_other_alex',
        activityId: 'activity_other',
        userOpenId: 'openid_alex',
        signupName: 'Alex',
        status: 'joined',
        attendanceStatus: 'present'
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

const dateRange = {
  startAt: '2026-05-01T00:00:00.000Z',
  endAt: '2026-05-31T23:59:59.999Z'
};

test('admin can get date-range attendance stats for confirmed activities', async () => {
  const db = createFakeDb();

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_admin' }, { db });

  expect(result.items).toEqual([
    {
      participantName: 'Alex',
      managerAlias: 'Left foot',
      signupCount: 3,
      presentCount: 2,
      absentCount: 1,
      attendanceRate: 0.6667
    },
    {
      participantName: 'Ben',
      managerAlias: '',
      signupCount: 1,
      presentCount: 1,
      absentCount: 0,
      attendanceRate: 1
    }
  ]);
});

test('organizer stats include only their own activities', async () => {
  const db = createFakeDb();

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, { db });

  expect(result.items).toEqual([
    {
      participantName: 'Alex',
      managerAlias: 'Left foot',
      signupCount: 2,
      presentCount: 1,
      absentCount: 1,
      attendanceRate: 0.5
    },
    {
      participantName: 'Ben',
      managerAlias: '',
      signupCount: 1,
      presentCount: 1,
      absentCount: 0,
      attendanceRate: 1
    }
  ]);
});

test('blank attendanceStatus counts as present', async () => {
  const db = createFakeDb();

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, { db });

  expect(result.items.find(item => item.participantName === 'Ben')).toMatchObject({
    signupCount: 1,
    presentCount: 1,
    absentCount: 0,
    attendanceRate: 1
  });
});

test('attendance stats include participant manager alias notes', async () => {
  const db = createFakeDb({
    users: {
      openid_alex: { _id: 'openid_alex', roles: ['user'], managerAlias: 'Bench note' }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, { db });

  expect(result.items.find(item => item.participantName === 'Alex')).toMatchObject({
    managerAlias: 'Bench note'
  });
});

test('cancelled deleted future pending and out-of-range activities are excluded', async () => {
  const db = createFakeDb({
    activities: {
      activity_pending: {
        _id: 'activity_pending',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'pending',
        startAt: '2026-05-09T12:00:00.000Z'
      },
      activity_cancelled: {
        _id: 'activity_cancelled',
        organizerOpenId: 'openid_owner',
        status: 'cancelled',
        confirmStatus: 'confirmed',
        startAt: '2026-05-10T12:00:00.000Z'
      },
      activity_deleted: {
        _id: 'activity_deleted',
        organizerOpenId: 'openid_owner',
        status: 'deleted',
        confirmStatus: 'confirmed',
        startAt: '2026-05-11T12:00:00.000Z'
      },
      activity_out_of_range: {
        _id: 'activity_out_of_range',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'confirmed',
        startAt: '2026-06-01T12:00:00.000Z'
      }
    },
    registrations: {
      reg_pending_player: {
        _id: 'reg_pending_player',
        activityId: 'activity_pending',
        signupName: 'Pending Player',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_cancelled_player: {
        _id: 'reg_cancelled_player',
        activityId: 'activity_cancelled',
        signupName: 'Cancelled Player',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_deleted_player: {
        _id: 'reg_deleted_player',
        activityId: 'activity_deleted',
        signupName: 'Deleted Player',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_out_of_range_player: {
        _id: 'reg_out_of_range_player',
        activityId: 'activity_out_of_range',
        signupName: 'Out Of Range Player',
        status: 'joined',
        attendanceStatus: 'present'
      }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, {
    db,
    now: '2026-05-08T00:00:00.000Z'
  });
  const names = result.items.map(item => item.participantName);

  expect(names).not.toContain('Pending Player');
  expect(names).not.toContain('Cancelled Player');
  expect(names).not.toContain('Deleted Player');
  expect(names).not.toContain('Out Of Range Player');
});

test('pending activities are included after their start time when not cancelled or deleted', async () => {
  const db = createFakeDb({
    activities: {
      activity_pending_past: {
        _id: 'activity_pending_past',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'pending',
        startAt: '2026-05-09T12:00:00.000Z'
      },
      activity_pending_future: {
        _id: 'activity_pending_future',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'pending',
        startAt: '2026-05-11T12:00:00.000Z'
      },
      activity_pending_cancelled: {
        _id: 'activity_pending_cancelled',
        organizerOpenId: 'openid_owner',
        status: 'cancelled',
        confirmStatus: 'pending',
        startAt: '2026-05-09T12:00:00.000Z'
      },
      activity_pending_deleted: {
        _id: 'activity_pending_deleted',
        organizerOpenId: 'openid_owner',
        status: 'deleted',
        confirmStatus: 'pending',
        startAt: '2026-05-09T12:00:00.000Z'
      }
    },
    registrations: {
      reg_pending_past: {
        _id: 'reg_pending_past',
        activityId: 'activity_pending_past',
        signupName: 'Past Pending Player',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_pending_future: {
        _id: 'reg_pending_future',
        activityId: 'activity_pending_future',
        signupName: 'Future Pending Player',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_pending_cancelled: {
        _id: 'reg_pending_cancelled',
        activityId: 'activity_pending_cancelled',
        signupName: 'Cancelled Pending Player',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_pending_deleted: {
        _id: 'reg_pending_deleted',
        activityId: 'activity_pending_deleted',
        signupName: 'Deleted Pending Player',
        status: 'joined',
        attendanceStatus: 'present'
      }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, {
    db,
    now: '2026-05-10T12:00:00.000Z'
  });
  const names = result.items.map(item => item.participantName);

  expect(names).toContain('Past Pending Player');
  expect(names).not.toContain('Future Pending Player');
  expect(names).not.toContain('Cancelled Pending Player');
  expect(names).not.toContain('Deleted Pending Player');
});

test('proxy signups are included by display name', async () => {
  const db = createFakeDb({
    registrations: {
      reg_proxy_guest: {
        _id: 'reg_proxy_guest',
        activityId: 'activity_1',
        userOpenId: 'proxy_openid_guest',
        signupName: 'Guest Player',
        status: 'joined',
        proxyRegistration: true,
        attendanceStatus: 'present'
      }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, { db });

  expect(result.items.find(item => item.participantName === 'Guest Player')).toMatchObject({
    signupCount: 1,
    presentCount: 1,
    absentCount: 0,
    attendanceRate: 1
  });
});

test('regular user cannot get attendance stats', async () => {
  const db = createFakeDb();

  await expect(
    getAttendanceStats.main(dateRange, { OPENID: 'openid_regular' }, { db })
  ).rejects.toThrow('Only organizers or admins can view attendance stats');
});
