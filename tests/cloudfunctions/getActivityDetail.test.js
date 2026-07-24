const getActivityDetail = require('../../cloudfunctions/getActivityDetail/index');
const exportActivityRoster = require('../../cloudfunctions/exportActivityRoster/index');

test('getActivityDetail returns teams and my registration', async () => {
  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_b' },
    {
      loadActivityDetail: async () => ({
        activity: { _id: 'activity_1', title: 'Saturday 8-10' },
        teams: [{ _id: 'team_white', teamName: 'White', members: [] }],
        myRegistration: {
          _id: 'activity_1_openid_b',
          teamId: 'team_white',
          status: 'joined'
        }
      })
    }
  );

  expect(result.activity._id).toBe('activity_1');
  expect(result.teams).toHaveLength(1);
  expect(result.myRegistration.teamId).toBe('team_white');
});

test('getActivityDetail groups joined members under each team', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    organizerOpenId: 'openid_owner',
    addressText: 'Half Stone',
    activitySummary: 'Manager-only summary'
  };
  const teams = [
    {
      _id: 'team_white',
      activityId: 'activity_1',
      teamName: 'White',
      sort: 0,
      maxMembers: 6,
      joinedCount: 1
    },
    {
      _id: 'team_red',
      activityId: 'activity_1',
      teamName: 'Red',
      sort: 1,
      maxMembers: 6,
      joinedCount: 1
    }
  ];
  const registrations = [
    {
      _id: 'activity_1_openid_a',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_a',
      status: 'joined',
      signupName: 'Alex',
      avatarUrl: 'https://example.com/avatar-a.png',
      preferredPositions: ['前锋', '门将'],
      proxyRegistration: true,
      attendanceStatus: 'absent',
      attendanceMarkedAt: '2026-05-19T10:00:00.000Z',
      attendanceMarkedBy: 'openid_owner',
      performanceDescription: 'Pressed well',
      joinedAt: '2026-04-19T10:00:00.000Z'
    },
    {
      _id: 'activity_1_openid_c',
      activityId: 'activity_1',
      teamId: 'team_red',
      userOpenId: 'openid_c',
      status: 'joined',
      signupName: 'Chris',
      proxyRegistration: false,
      performanceDescription: 'Good build-up play',
      joinedAt: '2026-04-19T10:05:00.000Z'
    }
  ];
  const users = [
    {
      _id: 'openid_a',
      avatarUrl: 'https://example.com/avatar-a.png'
    },
    {
      _id: 'openid_c',
      avatarUrl: '',
      avatarURL: 'cloud://prod-env-123/user-avatars/chris.jpg',
      managerAlias: 'Zhang San'
    }
  ];

  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'registrations') {
                const registration = registrations.find(item => item._id === id);
                if (registration) {
                  return { data: registration };
                }

                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            async get() {
              if (name === 'activity_teams') {
                return { data: teams.filter(item => item.activityId === query.activityId) };
              }

              if (name === 'registrations') {
                return {
                  data: registrations.filter(
                    item => item.activityId === query.activityId && item.status === query.status
                  )
                };
              }

              if (name === 'users') {
                return {
                  data: users.filter(item => query._id.values.includes(item._id))
                };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db: fakeDb }
  );

  expect(result.teams).toHaveLength(2);
  expect(result.activity.activitySummary).toBe('Manager-only summary');
  expect(result.teams[0].members[0]).toMatchObject({
    registrationId: 'activity_1_openid_a',
    signupName: 'Alex',
    avatarUrl: 'https://example.com/avatar-a.png',
    preferredPositions: ['前锋', '门将'],
    proxyRegistration: true,
    attendanceStatus: 'absent',
    attendanceMarkedAt: '2026-05-19T10:00:00.000Z',
    attendanceMarkedBy: 'openid_owner',
    performanceDescription: 'Pressed well'
  });
  expect(result.teams[1].members[0]).toMatchObject({
    signupName: 'Chris',
    avatarUrl: 'cloud://prod-env-123/user-avatars/chris.jpg',
    managerAlias: 'Zhang San',
    performanceDescription: 'Good build-up play'
  });

  const regularResult = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_viewer' },
    { db: fakeDb }
  );

  expect(regularResult.teams[0].members[0]).toMatchObject({
    preferredPositions: result.teams[0].members[0].preferredPositions
  });
  expect(regularResult.teams[0].members[0]).not.toHaveProperty('proxyRegistration');
  expect(regularResult.teams[0].members[0]).not.toHaveProperty('registrationId');
  expect(regularResult.teams[0].members[0]).not.toHaveProperty('attendanceStatus');
  expect(regularResult.teams[0].members[0]).not.toHaveProperty('performanceDescription');
  expect(regularResult.activity).not.toHaveProperty('activitySummary');
  expect(regularResult.teams[1].members[0]).not.toHaveProperty('managerAlias');
});

test('getActivityDetail uses registration avatar when user profile avatar is unavailable', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    addressText: 'Half Stone'
  };
  const teams = [
    {
      _id: 'team_white',
      activityId: 'activity_1',
      teamName: 'White',
      sort: 0,
      maxMembers: 6,
      joinedCount: 1
    }
  ];
  const registrations = [
    {
      _id: 'activity_1_openid_a',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_a',
      status: 'joined',
      signupName: 'Alex',
      avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg',
      joinedAt: '2026-04-19T10:00:00.000Z'
    }
  ];

  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'registrations') {
                const registration = registrations.find(item => item._id === id);
                if (registration) {
                  return { data: registration };
                }

                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            async get() {
              if (name === 'activity_teams') {
                return { data: teams.filter(item => item.activityId === query.activityId) };
              }

              if (name === 'registrations') {
                return {
                  data: registrations.filter(
                    item => item.activityId === query.activityId && item.status === query.status
                  )
                };
              }

              if (name === 'users') {
                return { data: [] };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_a' },
    { db: fakeDb }
  );

  expect(result.teams[0].members[0]).toMatchObject({
    signupName: 'Alex',
    avatarUrl: 'cloud://prod-env-123/user-avatars/alex.jpg'
  });
});

test('getActivityDetail returns viewer permissions for organizer and signup cancellation', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    organizerOpenId: 'openid_owner',
    status: 'published',
    joinedCount: 1,
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone'
  };
  const teams = [
    {
      _id: 'team_white',
      activityId: 'activity_1',
      teamName: 'White',
      sort: 0,
      maxMembers: 6,
      joinedCount: 1
    }
  ];
  const registrations = [
    {
      _id: 'activity_1_openid_player',
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: 'openid_player',
      status: 'joined',
      signupName: 'Alex',
      joinedAt: '2026-04-19T10:00:00.000Z'
    }
  ];

  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'registrations') {
                const registration = registrations.find(item => item._id === id);
                if (registration) {
                  return { data: registration };
                }

                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            async get() {
              if (name === 'activity_teams') {
                return { data: teams.filter(item => item.activityId === query.activityId) };
              }

              if (name === 'registrations') {
                return {
                  data: registrations.filter(
                    item => item.activityId === query.activityId && item.status === query.status
                  )
                };
              }

              if (name === 'users') {
                return { data: [] };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const organizerDetail = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db: fakeDb, now: () => '2026-04-26T18:00:00.000Z' }
  );

  expect(organizerDetail.viewer).toMatchObject({
    isOrganizer: true,
    canCancelActivity: true,
    canDeleteActivity: false
  });

  const playerDetail = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_player' },
    { db: fakeDb, now: () => '2026-04-26T18:00:00.000Z' }
  );

  expect(playerDetail.viewer).toMatchObject({
    isOrganizer: false,
    canCancelSignup: true
  });
});

test('getActivityDetail exposes edit permission for admins', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    organizerOpenId: 'openid_owner',
    status: 'published',
    joinedCount: 0,
    signupDeadlineAt: '2026-04-26T19:30:00.000Z'
  };
  const users = {
    openid_admin: {
      _id: 'openid_admin',
      roles: ['admin']
    }
  };
  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'users') {
                return { data: users[id] || null };
              }

              if (name === 'registrations') {
                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            async get() {
              if (name === 'activity_teams' || name === 'registrations' || name === 'users') {
                return { data: [] };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_admin' },
    { db: fakeDb }
  );

  expect(result.viewer).toMatchObject({
    isOrganizer: false,
    canEditActivity: true,
    canManageRegistrations: true,
    canCancelActivity: true
  });
});

test('getActivityDetail exposes manager registration notification subscription state', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    organizerOpenId: 'openid_owner',
    status: 'published',
    joinedCount: 0,
    signupDeadlineAt: '2026-04-26T19:30:00.000Z'
  };
  const notificationSubscriptions = [
    {
      _id: 'activity_1_openid_owner_manager_registration_notice',
      activityId: 'activity_1',
      userOpenId: 'openid_owner',
      templateKey: 'manager_registration_notice',
      templateId: 'tmpl_manager',
      status: 'accepted'
    },
    {
      _id: 'activity_1_openid_owner_manager_late_cancellation_notice',
      activityId: 'activity_1',
      userOpenId: 'openid_owner',
      templateKey: 'manager_late_cancellation_notice',
      templateId: 'tmpl_late_cancel',
      status: 'accepted'
    },
    {
      _id: 'activity_1_openid_regular_activity_notice',
      activityId: 'activity_1',
      userOpenId: 'openid_regular',
      templateKey: 'activity_notice',
      status: 'accepted'
    }
  ];
  const fakeDb = {
    command: {
      in(values) {
        return { values };
      }
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'users') {
                return { data: null };
              }

              if (name === 'registrations') {
                throw new Error('not found');
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where(query) {
          return {
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            async get() {
              if (name === 'activity_teams' || name === 'registrations' || name === 'users') {
                return { data: [] };
              }

              if (name === 'notification_subscriptions') {
                return {
                  data: notificationSubscriptions.filter(
                    item =>
                      item.activityId === query.activityId &&
                      item.userOpenId === query.userOpenId &&
                      item.templateKey === query.templateKey &&
                      item.status === query.status
                  )
                };
              }

              throw new Error(`Unsupported query for ${name}`);
            }
          };
        }
      };
    }
  };

  const organizerResult = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db: fakeDb }
  );
  const regularResult = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_regular' },
    { db: fakeDb }
  );

  expect(organizerResult.viewer.registrationNotificationSubscribed).toBe(true);
  expect(organizerResult.viewer.registrationNotificationSubscriptionTemplateId).toBe(
    'tmpl_manager'
  );
  expect(organizerResult.viewer.lateCancellationNotificationSubscribed).toBe(true);
  expect(organizerResult.viewer.lateCancellationNotificationSubscriptionTemplateId).toBe(
    'tmpl_late_cancel'
  );
  expect(regularResult.viewer.registrationNotificationSubscribed).toBe(false);
  expect(regularResult.viewer.registrationNotificationSubscriptionTemplateId).toBe('');
  expect(regularResult.viewer.lateCancellationNotificationSubscribed).toBe(false);
  expect(regularResult.viewer.lateCancellationNotificationSubscriptionTemplateId).toBe('');
});

test('getActivityDetail returns every joined member for a large activity', async () => {
  const activity = {
    _id: 'activity_1',
    title: 'Saturday 8-10',
    organizerOpenId: 'openid_owner',
    status: 'published'
  };
  const teams = [
    {
      _id: 'team_white',
      activityId: 'activity_1',
      teamName: 'White',
      sort: 0,
      status: 'active'
    }
  ];
  const registrations = [
    ...Array.from({ length: 100 }, (_, index) => ({
      _id: `reg_unrelated_${index}`,
      activityId: 'activity_other',
      teamId: 'team_other',
      userOpenId: `openid_unrelated_${index}`,
      status: 'joined',
      signupName: `Unrelated ${index}`,
      joinedAt: '2026-06-01T09:00:00.000Z'
    })),
    ...Array.from({ length: 105 }, (_, index) => ({
      _id: `reg_target_${index}`,
      activityId: 'activity_1',
      teamId: 'team_white',
      userOpenId: `openid_target_${index}`,
      status: 'joined',
      signupName: `Target ${index}`,
      joinedAt: '2026-06-01T10:00:00.000Z'
    }))
  ];
  const users = registrations
    .filter(registration => registration.activityId === 'activity_1')
    .map(registration => ({ _id: registration.userOpenId }));

  const queryHistory = [];

  function createQuery(items, criteria = null, offset = 0, count = 100, order = null) {
    return {
      where(nextCriteria) {
        return createQuery(items, nextCriteria, offset, count, order);
      },
      orderBy(field, direction) {
        return createQuery(items, criteria, offset, count, { field, direction });
      },
      skip(nextOffset) {
        return createQuery(items, criteria, nextOffset, count, order);
      },
      limit(nextCount) {
        return createQuery(items, criteria, offset, nextCount, order);
      },
      async get() {
        const filtered = items.filter(item =>
          Object.entries(criteria || {}).every(([key, value]) => {
            if (value && Array.isArray(value.values)) {
              return value.values.includes(item[key]);
            }

            if (value && value.operator === 'gt') {
              return String(item[key]) > String(value.value);
            }

            return item[key] === value;
          })
        );
        const ordered = order
          ? [...filtered].sort((left, right) => {
              const comparison = String(left[order.field]).localeCompare(String(right[order.field]));
              return order.direction === 'desc' ? -comparison : comparison;
            })
          : filtered;

        queryHistory.push({ criteria, order });

        return { data: ordered.slice(offset, offset + count) };
      }
    };
  }

  const fakeDb = {
    command: {
      in(values) {
        return { values };
      },
      gt(value) {
        return { operator: 'gt', value };
      }
    },
    collection(name) {
      const itemsByCollection = {
        activity_teams: teams,
        registrations,
        users
      };
      const query = createQuery(itemsByCollection[name] || []);

      return {
        doc(id) {
          return {
            async get() {
              if (name === 'activities') {
                return { data: activity };
              }

              if (name === 'registrations') {
                const registration = registrations.find(item => item._id === id);
                if (registration) {
                  return { data: registration };
                }

                throw new Error('not found');
              }

              if (name === 'users') {
                return { data: users.find(item => item._id === id) || null };
              }

              throw new Error(`Unsupported doc lookup for ${name}`);
            }
          };
        },
        where: query.where,
        orderBy: query.orderBy,
        skip: query.skip,
        limit: query.limit,
        get: query.get
      };
    }
  };

  const detail = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db: fakeDb }
  );

  expect(detail.teams.flatMap(team => team.members)).toHaveLength(105);
  const registrationQueries = queryHistory.filter(
    query => query.criteria.activityId === 'activity_1' && query.criteria.status === 'joined'
  );

  expect(registrationQueries).toHaveLength(2);
  expect(registrationQueries.every(query => query.order)).toBe(true);
  expect(registrationQueries.every(query => query.order.field === '_id')).toBe(true);
  expect(registrationQueries.every(query => query.order.direction === 'asc')).toBe(true);
  expect(registrationQueries[1].criteria._id).toMatchObject({ operator: 'gt' });
});

test('getActivityDetail keeps joined members on inactive teams in parity with roster export', async () => {
  const state = {
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['user', 'organizer'] },
      openid_player: { _id: 'openid_player', roles: ['user'] }
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Saturday 8-10',
        organizerOpenId: 'openid_owner',
        status: 'published'
      }
    },
    activity_teams: {
      team_inactive: {
        _id: 'team_inactive',
        activityId: 'activity_1',
        teamName: 'Inactive',
        sort: 1,
        status: 'inactive'
      }
    },
    registrations: {
      reg_inactive: {
        _id: 'reg_inactive',
        activityId: 'activity_1',
        teamId: 'team_inactive',
        userOpenId: 'openid_player',
        status: 'joined',
        signupName: 'Player',
        joinedAt: '2026-06-01T10:00:00.000Z'
      }
    }
  };

  function createQuery(items, criteria = null, offset = 0, count = 100, order = null) {
    return {
      where(nextCriteria) {
        return createQuery(items, nextCriteria, offset, count, order);
      },
      orderBy(field, direction) {
        return createQuery(items, criteria, offset, count, { field, direction });
      },
      skip(nextOffset) {
        return createQuery(items, criteria, nextOffset, count, order);
      },
      limit(nextCount) {
        return createQuery(items, criteria, offset, nextCount, order);
      },
      async get() {
        const filtered = Object.values(items || {}).filter(item =>
          Object.entries(criteria || {}).every(([key, value]) => {
            if (value && Array.isArray(value.values)) {
              return value.values.includes(item[key]);
            }

            if (value && value.operator === 'gt') {
              return String(item[key]) > String(value.value);
            }

            return item[key] === value;
          })
        );
        const ordered = order
          ? [...filtered].sort((left, right) => {
              const comparison = String(left[order.field]).localeCompare(String(right[order.field]));
              return order.direction === 'desc' ? -comparison : comparison;
            })
          : filtered;

        return { data: ordered.slice(offset, offset + count) };
      }
    };
  }

  const db = {
    command: {
      in(values) {
        return { values };
      },
      gt(value) {
        return { operator: 'gt', value };
      }
    },
    collection(name) {
      const query = createQuery(state[name]);

      return {
        doc(id) {
          return {
            async get() {
              return { data: state[name][id] || null };
            }
          };
        },
        where: query.where,
        orderBy: query.orderBy,
        skip: query.skip,
        limit: query.limit,
        get: query.get
      };
    }
  };

  const detail = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db }
  );
  const exported = await exportActivityRoster.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_owner' },
    { db }
  );

  expect(detail.teams.flatMap(team => team.members).map(member => member.registrationId)).toEqual(
    exported.rows.map(row => row.registrationId)
  );
});
