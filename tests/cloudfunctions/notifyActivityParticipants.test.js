const notifyActivityParticipants = require('../../cloudfunctions/notifyActivityParticipants/index');

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
      return {
        async get() {
          const data = Object.values(dataByCollection).filter(item =>
            Object.keys(query).every(key => item[key] === query[key])
          );

          return { data };
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
    notification_logs: seed.notificationLogs || {}
  };

  return {
    writes,
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
