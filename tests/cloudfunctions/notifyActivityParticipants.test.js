const { execFileSync } = require('child_process');
const notifyActivityParticipants = require('../../cloudfunctions/notifyActivityParticipants/index');

function matchesQuery(item, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (expected && expected.gt !== undefined) {
      return String(item[key] || '') > String(expected.gt);
    }
    return item[key] === expected;
  });
}

function createCollection(dataByCollection, writes) {
  return {
    doc(id) {
      return {
        async get() {
          return {
            data: dataByCollection[id] || null
          };
        },
        async update({ data }) {
          writes.updates.push({ id, data });
          Object.assign(dataByCollection[id], data);
          return {};
        }
      };
    },
    where(query) {
      let queryLimit = 100;
      let order = null;
      return {
        orderBy(field, direction) {
          order = { field, direction };
          return this;
        },
        limit(value) {
          queryLimit = value;
          return this;
        },
        async get() {
          let data = Object.values(dataByCollection).filter(item => matchesQuery(item, query));

          if (order) {
            data = data.slice().sort((left, right) => {
              const result = String(left[order.field] || '').localeCompare(
                String(right[order.field] || '')
              );
              return order.direction === 'desc' ? -result : result;
            });
          }

          return { data: data.slice(0, queryLimit) };
        }
      };
    },
    async add({ data }) {
      writes.adds.push(data);
      return { _id: `log_${writes.adds.length}` };
    }
  };
}

function createFakeDb(seed) {
  const writes = {
    updates: [],
    adds: []
  };
  const data = {
    activities: seed.activities || {},
    users: seed.users || {},
    registrations: seed.registrations || {},
    notification_subscriptions: seed.notificationSubscriptions || {},
    notification_logs: seed.notificationLogs || {},
    web_admin_sessions: seed.webAdminSessions || {}
  };

  return {
    writes,
    command: {
      gt(value) {
        return { gt: value };
      }
    },
    collection(name) {
      return createCollection(data[name], writes);
    }
  };
}

test('buildMessageData maps activity data to the configured training reminder template fields', () => {
  expect(
    notifyActivityParticipants.buildMessageData(
      {
        title: 'Saturday 8-10',
        startAt: new Date(2026, 3, 26, 20, 0).toISOString(),
        addressName: 'Half Stone'
      },
      'proceeding'
    )
  ).toEqual({
    time2: {
      value: '2026-04-26 20:00'
    },
    thing3: {
      value: 'Saturday 8-10'
    },
    thing6: {
      value: '确认举行'
    },
    thing7: {
      value: '地点：Half Stone，请准时参加'
    }
  });
});

test('buildMessageData formats notification time in China local time under UTC runtime', () => {
  const script = `
    const notify = require('./cloudfunctions/notifyActivityParticipants/index');
    const data = notify.buildMessageData({
      title: 'May 3 training',
      startAt: '2026-05-03T12:00:00.000Z',
      addressName: 'Hongguan'
    }, 'proceeding');
    process.stdout.write(data.time2.value);
  `;

  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: 'UTC' },
    encoding: 'utf8'
  });

  expect(output).toBe('2026-05-03 20:00');
});

test('buildMessageData uses the organizer notification hint for proceeding notices only', () => {
  const activity = {
    title: 'Saturday 8-10',
    startAt: new Date(2026, 3, 26, 20, 0).toISOString(),
    addressName: 'Half Stone',
    notificationHint: '请提前10分钟到场，带深浅两套衣服'
  };

  expect(notifyActivityParticipants.buildMessageData(activity, 'proceeding')).toMatchObject({
    thing7: {
      value: '请提前10分钟到场，带深浅两套衣服'
    }
  });
  expect(notifyActivityParticipants.buildMessageData(activity, 'cancelled')).toMatchObject({
    thing7: {
      value: '地点：Half Stone，活动已取消'
    }
  });
});

test('buildMessageData sanitizes organizer notification hint before sending', () => {
  const activity = {
    title: 'Saturday 8-10',
    startAt: new Date(2026, 3, 26, 20, 0).toISOString(),
    addressName: 'Half Stone',
    notificationHint: '12345\n67890\t1234567890abc'
  };

  expect(notifyActivityParticipants.buildMessageData(activity, 'proceeding')).toMatchObject({
    thing7: {
      value: '12345 67890 12345678'
    }
  });
});

test('notifyActivityParticipants confirms the activity and sends proceeding notices to accepted joined users once', async () => {
  const fakeDb = createFakeDb({
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Saturday 8-10',
        startAt: new Date(2026, 3, 26, 20, 0).toISOString(),
        addressName: 'Half Stone',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'pending'
      }
    },
    users: {
      openid_owner: {
        _id: 'openid_owner',
        roles: ['organizer']
      }
    },
    registrations: {
      reg_1: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        status: 'joined'
      },
      reg_2: {
        activityId: 'activity_1',
        userOpenId: 'openid_declined',
        status: 'joined'
      }
    },
    notificationSubscriptions: {
      sub_1: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      },
      sub_2: {
        activityId: 'activity_1',
        userOpenId: 'openid_declined',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'declined'
      }
    }
  });
  const sendSubscribeMessage = jest.fn().mockResolvedValue({ errCode: 0 });
  const ensureNotificationCollections = jest.fn().mockResolvedValue({});

  const result = await notifyActivityParticipants.main(
    {
      activityId: 'activity_1',
      notificationType: 'proceeding'
    },
    { OPENID: 'openid_owner' },
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z',
      sendSubscribeMessage,
      ensureNotificationCollections
    }
  );

  expect(ensureNotificationCollections).toHaveBeenCalledWith(fakeDb);
  expect(fakeDb.writes.updates).toContainEqual({
    id: 'activity_1',
    data: {
      confirmStatus: 'confirmed',
      confirmedAt: '2026-04-19T10:00:00.000Z',
      confirmedByOpenId: 'openid_owner',
      updatedAt: '2026-04-19T10:00:00.000Z'
    }
  });
  expect(sendSubscribeMessage).toHaveBeenCalledTimes(1);
  expect(sendSubscribeMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      touser: 'openid_player',
      templateId: 'tmpl_123',
      data: {
        time2: {
          value: '2026-04-26 20:00'
        },
        thing3: {
          value: 'Saturday 8-10'
        },
        thing6: {
          value: '确认举行'
        },
        thing7: {
          value: '地点：Half Stone，请准时参加'
        }
      }
    })
  );
  expect(result).toMatchObject({
    activityId: 'activity_1',
    notificationType: 'proceeding',
    confirmed: true,
    sent: 1,
    failed: 0,
    skipped: 0
  });
  expect(fakeDb.writes.adds[0]).toMatchObject({
    activityId: 'activity_1',
    recipientOpenId: 'openid_player',
    notificationType: 'proceeding',
    status: 'sent'
  });
});

test('notifyActivityParticipants sends to accepted joined users beyond the first query page', async () => {
  const registrations = Object.fromEntries(
    Array.from({ length: 105 }, (_, index) => [
      `reg_${String(index).padStart(3, '0')}`,
      {
        _id: `reg_${String(index).padStart(3, '0')}`,
        activityId: 'activity_1',
        userOpenId: `openid_player_${index}`,
        status: 'joined'
      }
    ])
  );
  const notificationSubscriptions = Object.fromEntries(
    Array.from({ length: 105 }, (_, index) => [
      `sub_${String(index).padStart(3, '0')}`,
      {
        _id: `sub_${String(index).padStart(3, '0')}`,
        activityId: 'activity_1',
        userOpenId: `openid_player_${index}`,
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      }
    ])
  );
  const fakeDb = createFakeDb({
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Large Match',
        startAt: '2026-04-26T12:00:00.000Z',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'pending'
      }
    },
    users: {
      openid_owner: { _id: 'openid_owner', roles: ['organizer'] }
    },
    registrations,
    notificationSubscriptions
  });
  const sendSubscribeMessage = jest.fn().mockResolvedValue({ errCode: 0 });

  const result = await notifyActivityParticipants.main(
    { activityId: 'activity_1', notificationType: 'proceeding' },
    { OPENID: 'openid_owner' },
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z',
      sendSubscribeMessage,
      ensureNotificationCollections: jest.fn().mockResolvedValue({})
    }
  );

  expect(sendSubscribeMessage).toHaveBeenCalledTimes(105);
  expect(result.sent).toBe(105);
});

test('notifyActivityParticipants accepts a web admin session token for confirmation', async () => {
  const fakeDb = createFakeDb({
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'pending'
      }
    },
    users: {
      openid_admin: {
        _id: 'openid_admin',
        roles: ['admin']
      }
    },
    registrations: {},
    notificationSubscriptions: {},
    webAdminSessions: {
      session_1: {
        sessionToken: 'session_token_1',
        status: 'confirmed',
        confirmedOpenId: 'openid_admin',
        sessionExpiresAt: '2026-04-20T10:00:00.000Z'
      }
    }
  });

  const result = await notifyActivityParticipants.main(
    {
      activityId: 'activity_1',
      notificationType: 'proceeding',
      webAdminSessionToken: 'session_token_1'
    },
    {},
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z'
    }
  );

  expect(result).toMatchObject({
    activityId: 'activity_1',
    confirmed: true
  });
  expect(fakeDb.writes.updates).toContainEqual({
    id: 'activity_1',
    data: {
      confirmStatus: 'confirmed',
      confirmedAt: '2026-04-19T10:00:00.000Z',
      confirmedByOpenId: 'openid_admin',
      updatedAt: '2026-04-19T10:00:00.000Z'
    }
  });
});

test('notifyActivityParticipants confirms after activity start without sending proceeding notices', async () => {
  const fakeDb = createFakeDb({
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Saturday 8-10',
        startAt: '2026-04-19T09:00:00.000Z',
        organizerOpenId: 'openid_owner',
        status: 'published',
        confirmStatus: 'pending'
      }
    },
    users: {
      openid_owner: {
        _id: 'openid_owner',
        roles: ['organizer']
      }
    },
    registrations: {
      reg_1: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        status: 'joined'
      }
    },
    notificationSubscriptions: {
      sub_1: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      }
    }
  });
  const sendSubscribeMessage = jest.fn().mockResolvedValue({ errCode: 0 });

  const result = await notifyActivityParticipants.main(
    {
      activityId: 'activity_1',
      notificationType: 'proceeding'
    },
    { OPENID: 'openid_owner' },
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z',
      sendSubscribeMessage
    }
  );

  expect(sendSubscribeMessage).not.toHaveBeenCalled();
  expect(result).toMatchObject({
    confirmed: true,
    totalRecipients: 1,
    sent: 0,
    failed: 0,
    skipped: 1
  });
  expect(fakeDb.writes.adds).toContainEqual({
    activityId: 'activity_1',
    recipientOpenId: 'openid_player',
    notificationType: 'proceeding',
    status: 'skipped',
    reason: 'activity-already-started',
    createdAt: '2026-04-19T10:00:00.000Z'
  });
});

test('notifyActivityParticipants cancels the activity and skips recipients already notified', async () => {
  const fakeDb = createFakeDb({
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        organizerOpenId: 'openid_owner',
        status: 'published'
      }
    },
    users: {
      openid_admin: {
        _id: 'openid_admin',
        roles: ['admin']
      }
    },
    registrations: {
      reg_1: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        status: 'joined'
      }
    },
    notificationSubscriptions: {
      sub_1: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      }
    },
    notificationLogs: {
      log_1: {
        activityId: 'activity_1',
        recipientOpenId: 'openid_player',
        notificationType: 'cancelled',
        status: 'sent'
      }
    }
  });
  const sendSubscribeMessage = jest.fn();

  const result = await notifyActivityParticipants.main(
    {
      activityId: 'activity_1',
      notificationType: 'cancelled'
    },
    { OPENID: 'openid_admin' },
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z',
      sendSubscribeMessage
    }
  );

  expect(fakeDb.writes.updates).toContainEqual({
    id: 'activity_1',
    data: {
      status: 'cancelled',
      cancelledAt: '2026-04-19T10:00:00.000Z',
      cancelledByOpenId: 'openid_admin',
      updatedAt: '2026-04-19T10:00:00.000Z'
    }
  });
  expect(sendSubscribeMessage).not.toHaveBeenCalled();
  expect(result).toMatchObject({
    notificationType: 'cancelled',
    cancelled: true,
    sent: 0,
    failed: 0,
    skipped: 1
  });
});

test('notifyActivityParticipants cancels after activity start without sending cancellation notices', async () => {
  const fakeDb = createFakeDb({
    activities: {
      activity_1: {
        _id: 'activity_1',
        title: 'Saturday 8-10',
        startAt: '2026-04-19T09:00:00.000Z',
        organizerOpenId: 'openid_owner',
        status: 'published'
      }
    },
    users: {
      openid_owner: {
        _id: 'openid_owner',
        roles: ['organizer']
      }
    },
    registrations: {
      reg_1: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        status: 'joined'
      }
    },
    notificationSubscriptions: {
      sub_1: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      }
    }
  });
  const sendSubscribeMessage = jest.fn().mockResolvedValue({ errCode: 0 });

  const result = await notifyActivityParticipants.main(
    {
      activityId: 'activity_1',
      notificationType: 'cancelled'
    },
    { OPENID: 'openid_owner' },
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z',
      sendSubscribeMessage
    }
  );

  expect(sendSubscribeMessage).not.toHaveBeenCalled();
  expect(result).toMatchObject({
    cancelled: true,
    totalRecipients: 1,
    sent: 0,
    failed: 0,
    skipped: 1
  });
  expect(fakeDb.writes.adds).toContainEqual({
    activityId: 'activity_1',
    recipientOpenId: 'openid_player',
    notificationType: 'cancelled',
    status: 'skipped',
    reason: 'activity-already-started',
    createdAt: '2026-04-19T10:00:00.000Z'
  });
});
