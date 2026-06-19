const setRegistrationAttendance = require('../../cloudfunctions/setRegistrationAttendance/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
      openid_admin: { _id: 'openid_admin', roles: ['user', 'admin'] },
      openid_player: { _id: 'openid_player', roles: ['user'] },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Confirmed Match',
        organizerOpenId: 'openid_owner',
        confirmStatus: 'confirmed',
        status: 'published',
        startAt: '2026-05-19T09:00:00.000Z',
        ...(options.activity || {})
      }
    },
    registrations: {
      registration_1: {
        _id: 'registration_1',
        activityId: 'activity_1',
        teamId: 'team_green',
        userOpenId: 'openid_player',
        signupName: 'Player',
        status: 'joined',
        ...(options.registration || {})
      }
    },
    activity_logs: []
  };

  return {
    state,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              return { data: state[name][id] || null };
            },
            async update({ data }) {
              state[name][id] = {
                ...state[name][id],
                ...data
              };
              return { updated: 1 };
            }
          };
        },
        async add({ data }) {
          const id = `${name}_${state[name].length + 1}`;
          state[name].push({ _id: id, ...data });
          return { _id: id };
        }
      };
    }
  };
}

const fixedNow = () => new Date('2026-05-19T10:00:00.000Z');

test('organizer can mark an active registration absent on a confirmed activity', async () => {
  const db = createFakeDb();

  const result = await setRegistrationAttendance.main(
    {
      activityId: 'activity_1',
      registrationId: 'registration_1',
      attendanceStatus: 'absent'
    },
    { OPENID: 'openid_owner' },
    { db, now: fixedNow }
  );

  expect(result.registration).toMatchObject({
    _id: 'registration_1',
    attendanceStatus: 'absent',
    attendanceMarkedAt: '2026-05-19T10:00:00.000Z',
    attendanceMarkedBy: 'openid_owner'
  });
  expect(db.state.registrations.registration_1.attendanceStatus).toBe('absent');
});

test('admin can mark attendance on another organizer activity', async () => {
  const db = createFakeDb();

  const result = await setRegistrationAttendance.main(
    {
      activityId: 'activity_1',
      registrationId: 'registration_1',
      attendanceStatus: 'present'
    },
    { OPENID: 'openid_admin' },
    { db, now: fixedNow }
  );

  expect(result.registration.attendanceStatus).toBe('present');
});

test('regular user cannot mark attendance', async () => {
  const db = createFakeDb();

  await expect(
    setRegistrationAttendance.main(
      {
        activityId: 'activity_1',
        registrationId: 'registration_1',
        attendanceStatus: 'absent'
      },
      { OPENID: 'openid_player' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Only the organizer or an admin can update attendance');
});

test('attendance cannot be changed before the activity is confirmed', async () => {
  const db = createFakeDb({
    activity: {
      confirmStatus: 'pending'
    }
  });

  await expect(
    setRegistrationAttendance.main(
      {
        activityId: 'activity_1',
        registrationId: 'registration_1',
        attendanceStatus: 'absent'
      },
      { OPENID: 'openid_owner' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Attendance can only be updated after activity is confirmed');
});

test('attendance can be changed before the activity starts', async () => {
  const db = createFakeDb({
    activity: {
      startAt: '2026-05-19T20:00:00.000Z'
    }
  });

  const result = await setRegistrationAttendance.main(
    {
      activityId: 'activity_1',
      registrationId: 'registration_1',
      attendanceStatus: 'absent'
    },
    { OPENID: 'openid_owner' },
    { db, now: fixedNow }
  );

  expect(result.registration).toMatchObject({
    _id: 'registration_1',
    attendanceStatus: 'absent',
    attendanceMarkedBy: 'openid_owner'
  });
});

test('attendance status only accepts present or absent', async () => {
  const db = createFakeDb();

  await expect(
    setRegistrationAttendance.main(
      {
        activityId: 'activity_1',
        registrationId: 'registration_1',
        attendanceStatus: 'late'
      },
      { OPENID: 'openid_owner' },
      { db, now: fixedNow }
    )
  ).rejects.toThrow('Invalid attendance status');
});

test('attendance update writes an activity log', async () => {
  const db = createFakeDb();

  await setRegistrationAttendance.main(
    {
      activityId: 'activity_1',
      registrationId: 'registration_1',
      attendanceStatus: 'absent'
    },
    { OPENID: 'openid_owner' },
    { db, now: fixedNow }
  );

  expect(db.state.activity_logs).toEqual([
    {
      _id: 'activity_logs_1',
      activityId: 'activity_1',
      action: 'attendance_update',
      operatorOpenId: 'openid_owner',
      registrationId: 'registration_1',
      userOpenId: 'openid_player',
      attendanceStatus: 'absent',
      createdAt: '2026-05-19T10:00:00.000Z'
    }
  ]);
});
