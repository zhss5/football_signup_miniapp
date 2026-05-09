const {
  buildManagerRegistrationMessageData,
  notifyActivityManagers
} = require('../../cloudfunctions/_shared/manager-notifications');

function createCollection(dataByCollection, writes) {
  return {
    doc(id) {
      return {
        async get() {
          return {
            data: dataByCollection[id] || null
          };
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
    adds: []
  };
  const data = {
    users: seed.users || {},
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

test('buildManagerRegistrationMessageData maps join and cancel changes to the activity notice template', () => {
  const activity = {
    title: 'May 9 training',
    startAt: '2026-05-09T12:00:00.000Z'
  };

  expect(
    buildManagerRegistrationMessageData(activity, {
      changeType: 'registration_joined',
      actorName: 'Alex'
    })
  ).toEqual({
    time2: {
      value: '2026-05-09 20:00'
    },
    thing3: {
      value: 'May 9 training'
    },
    thing6: {
      value: '报名变更'
    },
    thing7: {
      value: 'Alex 已报名'
    }
  });

  expect(
    buildManagerRegistrationMessageData(activity, {
      changeType: 'registration_cancelled',
      actorName: 'Alex'
    })
  ).toMatchObject({
    thing7: {
      value: 'Alex 已退出'
    }
  });
});

test('notifyActivityManagers sends registration changes only to subscribed managers and excludes the actor', async () => {
  const fakeDb = createFakeDb({
    users: {
      openid_admin: {
        _id: 'openid_admin',
        roles: ['admin']
      },
      openid_regular: {
        _id: 'openid_regular',
        roles: ['user']
      }
    },
    notificationSubscriptions: {
      owner_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_owner',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      },
      admin_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_admin',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      },
      regular_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_regular',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      },
      actor_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      }
    }
  });
  const sendSubscribeMessage = jest.fn().mockResolvedValue({ errCode: 0 });

  const result = await notifyActivityManagers(
    fakeDb,
    {
      activity: {
        _id: 'activity_1',
        title: 'May 9 training',
        startAt: '2026-05-09T12:00:00.000Z',
        organizerOpenId: 'openid_owner'
      },
      actorOpenId: 'openid_player',
      actorName: 'Alex',
      changeType: 'registration_joined',
      stamp: '2026-05-09T10:00:00.000Z'
    },
    {
      sendSubscribeMessage,
      ensureNotificationCollections: jest.fn().mockResolvedValue({})
    }
  );

  expect(result).toMatchObject({
    totalRecipients: 2,
    sent: 2,
    failed: 0,
    skipped: 0
  });
  expect(sendSubscribeMessage).toHaveBeenCalledTimes(2);
  expect(sendSubscribeMessage.mock.calls.map(call => call[0].touser).sort()).toEqual([
    'openid_admin',
    'openid_owner'
  ]);
  expect(fakeDb.writes.adds).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        activityId: 'activity_1',
        actorOpenId: 'openid_player',
        recipientOpenId: 'openid_owner',
        notificationType: 'registration_joined',
        status: 'sent'
      }),
      expect.objectContaining({
        activityId: 'activity_1',
        actorOpenId: 'openid_player',
        recipientOpenId: 'openid_admin',
        notificationType: 'registration_joined',
        status: 'sent'
      })
    ])
  );
});

test('notifyActivityManagers skips manager self signup or cancellation notifications', async () => {
  const fakeDb = createFakeDb({
    notificationSubscriptions: {
      owner_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_owner',
        templateKey: 'activity_notice',
        templateId: 'tmpl_123',
        status: 'accepted'
      }
    }
  });
  const sendSubscribeMessage = jest.fn();

  const result = await notifyActivityManagers(
    fakeDb,
    {
      activity: {
        _id: 'activity_1',
        title: 'May 9 training',
        startAt: '2026-05-09T12:00:00.000Z',
        organizerOpenId: 'openid_owner'
      },
      actorOpenId: 'openid_owner',
      actorName: 'Owner',
      changeType: 'registration_cancelled',
      stamp: '2026-05-09T10:00:00.000Z'
    },
    {
      sendSubscribeMessage,
      ensureNotificationCollections: jest.fn().mockResolvedValue({})
    }
  );

  expect(result).toMatchObject({
    totalRecipients: 0,
    sent: 0
  });
  expect(sendSubscribeMessage).not.toHaveBeenCalled();
});
