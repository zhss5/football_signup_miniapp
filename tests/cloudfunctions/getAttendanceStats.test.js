const getAttendanceStats = require('../../cloudfunctions/getAttendanceStats/index');

function matchesQuery(item, query) {
  if (!query) {
    return true;
  }

  return Object.entries(query).every(([key, expected]) => {
    if (expected && Array.isArray(expected.values)) {
      return expected.values.includes(item[key]);
    }

    if (expected && Array.isArray(expected.notValues)) {
      return !expected.notValues.includes(item[key]);
    }

    if (expected && expected.gt !== undefined) {
      return String(item[key] || '') > String(expected.gt);
    }

    if (expected && expected.gte !== undefined && String(item[key] || '') < String(expected.gte)) {
      return false;
    }

    if (expected && expected.lte !== undefined && String(item[key] || '') > String(expected.lte)) {
      return false;
    }

    if (expected && (expected.gte !== undefined || expected.lte !== undefined)) {
      return true;
    }

    return item[key] === expected;
  });
}

function createCollectionQuery(source, state = {}, queryLog = null, collectionName = '') {
  const queryState = {
    query: null,
    order: [],
    limit: null,
    ...state
  };

  return {
    where(query) {
      return createCollectionQuery(source, { ...queryState, query }, queryLog, collectionName);
    },
    orderBy(field, direction) {
      return createCollectionQuery(source, {
        ...queryState,
        order: queryState.order.concat({ field, direction })
      }, queryLog, collectionName);
    },
    limit(count) {
      return createCollectionQuery(
        source,
        { ...queryState, limit: Number(count) || 0 },
        queryLog,
        collectionName
      );
    },
    async get() {
      if (queryLog) {
        queryLog.push({ collectionName, query: queryState.query });
      }
      let data = source.filter(item => matchesQuery(item, queryState.query));

      queryState.order.forEach(({ field, direction }) => {
        data = data.slice().sort((left, right) => {
          const result = String(left[field] || '').localeCompare(String(right[field] || ''));
          return direction === 'desc' ? -result : result;
        });
      });

      return { data: data.slice(0, queryState.limit === null ? 100 : queryState.limit) };
    }
  };
}

function createFakeDb(options = {}) {
  const queryLog = [];
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
    queryLog,
    command: {
      in(values) {
        return { values };
      },
      nin(values) {
        return { notValues: values };
      },
      gt(value) {
        return { gt: value };
      },
      gte(value) {
        return {
          gte: value,
          and(other) {
            return { gte: value, ...other };
          }
        };
      },
      lte(value) {
        return { lte: value };
      }
    },
    collection(name) {
      const query = createCollectionQuery(
        Object.values(state[name] || {}),
        {},
        queryLog,
        name
      );

      return {
        ...query,
        doc(id) {
          return {
            async get() {
              return { data: state[name][id] || null };
            }
          };
        }
      };
    }
  };
}

const dateRange = {
  startAt: '2026-05-01T00:00:00.000Z',
  endAt: '2026-05-31T23:59:59.999Z'
};

test('admin can get date-range attendance stats for started activities', async () => {
  const db = createFakeDb();

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_admin' }, { db });

  expect(result.items).toMatchObject([
    {
      participantName: 'Alex',
      managerAlias: 'Left foot',
      signupCount: 3,
      presentCount: 2,
      absentCount: 1,
      attendanceRate: 0.6667,
      effectiveSignupActivityCount: 3,
      cancelledActivityCount: 0,
      cancelRate: 0,
      details: [
        {
          activityId: 'activity_1',
          activityTitle: 'Confirmed Match 1',
          activityType: 'internal',
          startAt: '2026-05-01T12:00:00.000Z',
          teamName: '',
          signupName: 'Alex',
          managerAlias: 'Left foot',
          attendanceStatus: 'present'
        },
        {
          activityId: 'activity_2',
          activityTitle: 'Confirmed Match 2',
          activityType: 'internal',
          startAt: '2026-05-08T12:00:00.000Z',
          teamName: '',
          signupName: 'Alex',
          managerAlias: 'Left foot',
          attendanceStatus: 'absent'
        },
        {
          activityId: 'activity_other',
          activityTitle: 'Other Organizer Match',
          activityType: 'internal',
          startAt: '2026-05-08T12:00:00.000Z',
          teamName: '',
          signupName: 'Alex',
          managerAlias: 'Left foot',
          attendanceStatus: 'present'
        }
      ]
    },
    {
      participantName: 'Ben',
      managerAlias: '',
      signupCount: 1,
      presentCount: 1,
      absentCount: 0,
      attendanceRate: 1,
      effectiveSignupActivityCount: 1,
      cancelledActivityCount: 0,
      cancelRate: 0,
      details: [
        {
          activityId: 'activity_1',
          activityTitle: 'Confirmed Match 1',
          activityType: 'internal',
          startAt: '2026-05-01T12:00:00.000Z',
          teamName: '',
          signupName: 'Ben',
          managerAlias: '',
          attendanceStatus: 'present'
        }
      ]
    }
  ]);
});

test('organizer stats include only their own activities', async () => {
  const db = createFakeDb();

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, { db });

  expect(result.items).toMatchObject([
    {
      participantName: 'Alex',
      managerAlias: 'Left foot',
      signupCount: 2,
      presentCount: 1,
      absentCount: 1,
      attendanceRate: 0.5,
      effectiveSignupActivityCount: 2,
      cancelledActivityCount: 0,
      cancelRate: 0,
      details: [
        {
          activityId: 'activity_1',
          activityTitle: 'Confirmed Match 1',
          activityType: 'internal',
          startAt: '2026-05-01T12:00:00.000Z',
          teamName: '',
          signupName: 'Alex',
          managerAlias: 'Left foot',
          attendanceStatus: 'present'
        },
        {
          activityId: 'activity_2',
          activityTitle: 'Confirmed Match 2',
          activityType: 'internal',
          startAt: '2026-05-08T12:00:00.000Z',
          teamName: '',
          signupName: 'Alex',
          managerAlias: 'Left foot',
          attendanceStatus: 'absent'
        }
      ]
    },
    {
      participantName: 'Ben',
      managerAlias: '',
      signupCount: 1,
      presentCount: 1,
      absentCount: 0,
      attendanceRate: 1,
      effectiveSignupActivityCount: 1,
      cancelledActivityCount: 0,
      cancelRate: 0,
      details: [
        {
          activityId: 'activity_1',
          activityTitle: 'Confirmed Match 1',
          activityType: 'internal',
          startAt: '2026-05-01T12:00:00.000Z',
          teamName: '',
          signupName: 'Ben',
          managerAlias: '',
          attendanceStatus: 'present'
        }
      ]
    }
  ]);
});

test('attendance detail rows include activity type', async () => {
  const db = createFakeDb({
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Confirmed Match 1',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'confirmed',
        startAt: '2026-05-01T12:00:00.000Z',
        activityType: 'external'
      }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, { db });
  const alex = result.items.find(item => item.participantName === 'Alex');

  expect(alex.details.find(row => row.activityId === 'activity_1').activityType).toBe('external');
  expect(alex.details.find(row => row.activityId === 'activity_2').activityType).toBe('internal');
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

test('cancelled deleted future and out-of-range activities are excluded', async () => {
  const db = createFakeDb({
    activities: {
      activity_pending: {
        _id: 'activity_pending',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'pending',
        startAt: '2026-05-09T12:00:00.000Z'
      },
      activity_confirmed_future: {
        _id: 'activity_confirmed_future',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'confirmed',
        startAt: '2026-05-12T12:00:00.000Z'
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
      reg_confirmed_future_player: {
        _id: 'reg_confirmed_future_player',
        activityId: 'activity_confirmed_future',
        signupName: 'Future Confirmed Player',
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
  expect(names).not.toContain('Future Confirmed Player');
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

test('proxy signups with the same proxy name are grouped across activities', async () => {
  const db = createFakeDb({
    registrations: {
      reg_proxy_guest_1: {
        _id: 'reg_proxy_guest_1',
        activityId: 'activity_1',
        userOpenId: 'proxy_openid_guest_1',
        signupName: 'Guest Player',
        status: 'joined',
        proxyRegistration: true,
        attendanceStatus: 'present'
      },
      reg_proxy_guest_2: {
        _id: 'reg_proxy_guest_2',
        activityId: 'activity_2',
        userOpenId: 'proxy_openid_guest_2',
        signupName: 'Guest Player',
        status: 'joined',
        proxyRegistration: true,
        attendanceStatus: 'absent'
      }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, { db });

  expect(result.items.find(item => item.participantName === 'Guest Player')).toMatchObject({
    signupCount: 2,
    presentCount: 1,
    absentCount: 1,
    attendanceRate: 0.5
  });
});

test('attendance stats can filter by activity type and treats historical missing type as internal', async () => {
  const db = createFakeDb({
    activities: {
      activity_external: {
        _id: 'activity_external',
        title: 'External Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'confirmed',
        activityType: 'external',
        startAt: '2026-05-12T12:00:00.000Z'
      },
      activity_internal_explicit: {
        _id: 'activity_internal_explicit',
        title: 'Internal Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'confirmed',
        activityType: 'internal',
        startAt: '2026-05-13T12:00:00.000Z'
      }
    },
    registrations: {
      reg_external_player: {
        _id: 'reg_external_player',
        activityId: 'activity_external',
        userOpenId: 'openid_external',
        signupName: 'External Player',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_internal_player: {
        _id: 'reg_internal_player',
        activityId: 'activity_internal_explicit',
        userOpenId: 'openid_internal',
        signupName: 'Internal Player',
        status: 'joined',
        attendanceStatus: 'present'
      }
    }
  });

  const internalResult = await getAttendanceStats.main(
    {
      ...dateRange,
      activityType: 'internal'
    },
    { OPENID: 'openid_admin' },
    { db }
  );
  const externalResult = await getAttendanceStats.main(
    {
      ...dateRange,
      activityType: 'external'
    },
    { OPENID: 'openid_admin' },
    { db }
  );

  expect(internalResult.items.map(item => item.participantName)).toEqual(
    expect.arrayContaining(['Alex', 'Ben', 'Internal Player'])
  );
  expect(internalResult.items.map(item => item.participantName)).not.toContain('External Player');
  expect(externalResult.items.map(item => item.participantName)).toEqual(['External Player']);
});

test('cancellation stats count one final outcome per participant activity', async () => {
  const db = createFakeDb({
    activities: {
      activity_cancel_final: {
        _id: 'activity_cancel_final',
        title: 'Cancelled Signup Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        activityType: 'external',
        startAt: '2026-05-09T12:00:00.000Z'
      },
      activity_future_cancel: {
        _id: 'activity_future_cancel',
        title: 'Future Cancel Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        startAt: '2026-05-20T12:00:00.000Z'
      },
      activity_removed: {
        _id: 'activity_removed',
        title: 'Removed Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        startAt: '2026-05-10T12:00:00.000Z'
      },
      activity_cancelled_event: {
        _id: 'activity_cancelled_event',
        title: 'Cancelled Event',
        organizerOpenId: 'openid_owner',
        status: 'cancelled',
        startAt: '2026-05-11T12:00:00.000Z'
      }
    },
    registrations: {
      reg_alex_cancel_final: {
        _id: 'reg_alex_cancel_final',
        activityId: 'activity_cancel_final',
        userOpenId: 'openid_alex',
        signupName: 'Alex',
        status: 'cancelled',
        cancelCount: 2,
        cancelledAt: '2026-05-08T10:00:00.000Z'
      },
      reg_alex_future_cancel: {
        _id: 'reg_alex_future_cancel',
        activityId: 'activity_future_cancel',
        userOpenId: 'openid_alex',
        signupName: 'Alex',
        status: 'cancelled',
        cancelCount: 1
      },
      reg_alex_old_cancelled_activity_1: {
        _id: 'reg_alex_old_cancelled_activity_1',
        activityId: 'activity_1',
        userOpenId: 'openid_alex',
        signupName: 'Alex old name',
        status: 'cancelled',
        cancelledAt: '2026-04-30T10:00:00.000Z'
      },
      reg_alex_removed: {
        _id: 'reg_alex_removed',
        activityId: 'activity_removed',
        userOpenId: 'openid_alex',
        signupName: 'Alex',
        status: 'removed',
        removedCount: 1
      },
      reg_alex_cancelled_event: {
        _id: 'reg_alex_cancelled_event',
        activityId: 'activity_cancelled_event',
        userOpenId: 'openid_alex',
        signupName: 'Alex',
        status: 'cancelled',
        cancelCount: 1
      }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, {
    db,
    now: '2026-05-12T00:00:00.000Z'
  });
  const alex = result.items.find(item => item.participantName === 'Alex');

  expect(alex).toMatchObject({
    signupCount: 2,
    effectiveSignupActivityCount: 2,
    cancelledActivityCount: 2,
    cancelRate: 0.5
  });
  expect(alex.cancellationDetails).toEqual([
    {
      activityId: 'activity_1',
      activityTitle: 'Confirmed Match 1',
      activityType: 'internal',
      startAt: '2026-05-01T12:00:00.000Z',
      registrationId: 'reg_1_alex',
      signupName: 'Alex',
      managerAlias: 'Left foot',
      outcome: 'joined',
      cancelledAt: ''
    },
    {
      activityId: 'activity_2',
      activityTitle: 'Confirmed Match 2',
      activityType: 'internal',
      startAt: '2026-05-08T12:00:00.000Z',
      registrationId: 'reg_2_alex',
      signupName: 'Alex',
      managerAlias: 'Left foot',
      outcome: 'joined',
      cancelledAt: ''
    },
    {
      activityId: 'activity_cancel_final',
      activityTitle: 'Cancelled Signup Match',
      activityType: 'external',
      startAt: '2026-05-09T12:00:00.000Z',
      registrationId: 'reg_alex_cancel_final',
      signupName: 'Alex',
      managerAlias: 'Left foot',
      outcome: 'cancelled',
      cancelledAt: '2026-05-08T10:00:00.000Z'
    },
    {
      activityId: 'activity_future_cancel',
      activityTitle: 'Future Cancel Match',
      activityType: 'internal',
      startAt: '2026-05-20T12:00:00.000Z',
      registrationId: 'reg_alex_future_cancel',
      signupName: 'Alex',
      managerAlias: 'Left foot',
      outcome: 'cancelled',
      cancelledAt: ''
    }
  ]);
});

test('cancellation stats include cancellation-only participants', async () => {
  const db = createFakeDb({
    activities: {
      activity_cancel_only: {
        _id: 'activity_cancel_only',
        title: 'Cancel Only Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        startAt: '2026-05-09T12:00:00.000Z'
      }
    },
    registrations: {
      reg_cancel_only: {
        _id: 'reg_cancel_only',
        activityId: 'activity_cancel_only',
        userOpenId: 'openid_cancel_only',
        signupName: 'Cancel Only',
        status: 'cancelled',
        cancelCount: 1
      }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, {
    db,
    now: '2026-05-12T00:00:00.000Z'
  });

  expect(result.items.find(item => item.participantName === 'Cancel Only')).toMatchObject({
    signupCount: 0,
    presentCount: 0,
    absentCount: 0,
    attendanceRate: 0,
    effectiveSignupActivityCount: 0,
    cancelledActivityCount: 1,
    cancelRate: 1
  });
  expect(result.items.find(item => item.participantName === 'Cancel Only').cancellationDetails)
    .toEqual([
      expect.objectContaining({
        activityId: 'activity_cancel_only',
        registrationId: 'reg_cancel_only',
        outcome: 'cancelled'
      })
    ]);
});

test('real signups with the same display name are grouped by openid instead of name', async () => {
  const db = createFakeDb({
    users: {
      openid_sam_1: { _id: 'openid_sam_1', roles: ['user'], managerAlias: 'Sam Left' },
      openid_sam_2: { _id: 'openid_sam_2', roles: ['user'], managerAlias: 'Sam Right' }
    },
    registrations: {
      reg_sam_1: {
        _id: 'reg_sam_1',
        activityId: 'activity_1',
        userOpenId: 'openid_sam_1',
        signupName: 'Sam',
        status: 'joined',
        attendanceStatus: 'present'
      },
      reg_sam_2: {
        _id: 'reg_sam_2',
        activityId: 'activity_2',
        userOpenId: 'openid_sam_2',
        signupName: 'Sam',
        status: 'joined',
        attendanceStatus: 'absent'
      }
    }
  });

  const result = await getAttendanceStats.main(dateRange, { OPENID: 'openid_owner' }, { db });
  const samRows = result.items.filter(item => item.participantName === 'Sam');

  expect(samRows).toHaveLength(2);
  expect(samRows).toEqual(expect.arrayContaining([
    expect.objectContaining({
      managerAlias: 'Sam Left',
      signupCount: 1,
      presentCount: 1,
      absentCount: 0
    }),
    expect.objectContaining({
      managerAlias: 'Sam Right',
      signupCount: 1,
      presentCount: 0,
      absentCount: 1
    })
  ]));
});

test('attendance stats load all cursor batches before aggregating and paging sorted participants', async () => {
  const activities = Object.fromEntries(
    Array.from({ length: 100 }, (_, index) => {
      const id = `bulk_activity_${String(index).padStart(3, '0')}`;
      return [id, {
        _id: id,
        organizerOpenId: 'openid_other_owner',
        status: 'published',
        startAt: '2026-07-01T12:00:00.000Z'
      }];
    })
  );
  const registrations = Object.fromEntries(
    Array.from({ length: 100 }, (_, index) => {
      const id = `bulk_registration_${String(index).padStart(3, '0')}`;
      return [id, {
        _id: id,
        activityId: `bulk_activity_${String(index).padStart(3, '0')}`,
        signupName: `Unrelated ${index}`,
        status: 'joined',
        attendanceStatus: 'present'
      }];
    })
  );

  Array.from({ length: 45 }, (_, index) => {
    const suffix = String(index).padStart(3, '0');
    activities[`stats_activity_${suffix}`] = {
      _id: `stats_activity_${suffix}`,
      organizerOpenId: 'openid_owner',
      status: 'published',
      startAt: '2026-07-02T12:00:00.000Z'
    };
    registrations[`stats_registration_${suffix}`] = {
      _id: `stats_registration_${suffix}`,
      activityId: `stats_activity_${suffix}`,
      signupName: `Player ${suffix}`,
      status: 'joined',
      attendanceStatus: 'present'
    };
  });

  const result = await getAttendanceStats.main(
    {
      startAt: '2026-07-01T00:00:00.000Z',
      endAt: '2026-07-31T23:59:59.999Z',
      skip: 20
    },
    { OPENID: 'openid_owner' },
    { db: createFakeDb({ activities, registrations }), now: '2026-08-01T00:00:00.000Z' }
  );

  expect(result).toMatchObject({
    total: 45,
    limit: 20,
    skip: 20,
    hasMore: true
  });
  expect(result.items).toHaveLength(20);
  expect(result.items.map(item => item.participantName)).toEqual(
    Array.from({ length: 20 }, (_, index) => `Player ${String(index + 20).padStart(3, '0')}`)
  );
  expect(result.items[0]).toMatchObject({
    signupCount: 1,
    presentCount: 1
  });
});

test('statisticsType filters attendance and cancellation rows before pagination', async () => {
  const activities = {
    stats_activity: {
      _id: 'stats_activity',
      organizerOpenId: 'openid_owner',
      status: 'published',
      startAt: '2026-07-02T12:00:00.000Z'
    }
  };
  const registrations = Object.fromEntries([
    ...Array.from({ length: 25 }, (_, index) => {
      const suffix = String(index).padStart(2, '0');
      return [`joined_${suffix}`, {
        _id: `joined_${suffix}`,
        activityId: 'stats_activity',
        signupName: `Attendee ${suffix}`,
        status: 'joined',
        attendanceStatus: 'present'
      }];
    }),
    ...Array.from({ length: 5 }, (_, index) => {
      const suffix = String(index).padStart(2, '0');
      return [`cancelled_${suffix}`, {
        _id: `cancelled_${suffix}`,
        activityId: 'stats_activity',
        signupName: `Cancelled ${suffix}`,
        status: 'cancelled',
        cancelledAt: '2026-07-01T12:00:00.000Z'
      }];
    })
  ]);
  const db = createFakeDb({ activities, registrations });
  const input = {
    startAt: '2026-07-01T00:00:00.000Z',
    endAt: '2026-07-31T23:59:59.999Z',
    limit: 20,
    skip: 0
  };
  const deps = { db, now: '2026-08-01T00:00:00.000Z' };

  const attendance = await getAttendanceStats.main(
    { ...input, statisticsType: 'attendance' },
    { OPENID: 'openid_owner' },
    deps
  );
  const cancellation = await getAttendanceStats.main(
    { ...input, statisticsType: 'cancellation' },
    { OPENID: 'openid_owner' },
    deps
  );
  const both = await getAttendanceStats.main(
    { ...input, statisticsType: 'both' },
    { OPENID: 'openid_owner' },
    deps
  );

  expect(attendance).toMatchObject({
    total: 25,
    limit: 20,
    skip: 0,
    hasMore: true
  });
  expect(attendance.items).toHaveLength(20);
  expect(attendance.items.every(item => item.signupCount > 0)).toBe(true);

  expect(cancellation).toMatchObject({
    total: 30,
    limit: 20,
    skip: 0,
    hasMore: true
  });
  expect(cancellation.items).toHaveLength(20);
  expect(
    cancellation.items.every(
      item => item.effectiveSignupActivityCount + item.cancelledActivityCount > 0
    )
  ).toBe(true);

  expect(both).toMatchObject({
    projections: {
      attendance: {
        total: 25,
        limit: 20,
        skip: 0,
        hasMore: true
      },
      cancellation: {
        total: 30,
        limit: 20,
        skip: 0,
        hasMore: true
      }
    }
  });
  expect(both.projections.attendance.items).toHaveLength(20);
  expect(both.projections.cancellation.items).toHaveLength(20);
});

test('regular user cannot get attendance stats', async () => {
  const db = createFakeDb();

  await expect(
    getAttendanceStats.main(dateRange, { OPENID: 'openid_regular' }, { db })
  ).rejects.toThrow('Only organizers or admins can view attendance stats');
});

test('attendance stats scope activities before loading registrations and referenced users', async () => {
  const db = createFakeDb({
    activities: {
      activity_external: {
        _id: 'activity_external',
        title: 'External Match',
        organizerOpenId: 'openid_owner',
        status: 'published',
        activityType: 'external',
        startAt: '2026-05-10T12:00:00.000Z'
      },
      activity_external_other: {
        _id: 'activity_external_other',
        title: 'Other External Match',
        organizerOpenId: 'openid_other_owner',
        status: 'published',
        activityType: 'external',
        startAt: '2026-05-11T12:00:00.000Z'
      }
    },
    registrations: {
      reg_external: {
        _id: 'reg_external',
        activityId: 'activity_external',
        userOpenId: 'openid_alex',
        signupName: 'Alex',
        status: 'joined',
        attendanceStatus: 'present'
      }
    }
  });

  await getAttendanceStats.main(
    { ...dateRange, activityType: 'external' },
    { OPENID: 'openid_owner' },
    { db, now: '2026-06-01T00:00:00.000Z' }
  );

  const activityQueries = db.queryLog.filter(entry => entry.collectionName === 'activities');
  expect(activityQueries[0].query).toMatchObject({
    organizerOpenId: 'openid_owner',
    status: { notValues: ['cancelled', 'deleted'] },
    activityType: 'external',
    startAt: {
      gte: dateRange.startAt,
      lte: dateRange.endAt
    }
  });
  const registrationQueries = db.queryLog.filter(entry => entry.collectionName === 'registrations');
  expect(registrationQueries.every(entry => entry.query.activityId.values)).toBe(true);
  expect(new Set(registrationQueries.flatMap(entry => entry.query.activityId.values))).toEqual(
    new Set(['activity_external'])
  );
  const userQueries = db.queryLog.filter(entry => entry.collectionName === 'users');
  expect(userQueries.every(entry => entry.query._id.values)).toBe(true);
  expect(new Set(userQueries.flatMap(entry => entry.query._id.values))).toEqual(
    new Set(['openid_alex'])
  );
});
