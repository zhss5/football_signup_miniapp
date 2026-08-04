const {
  buildManagerRegistrationMessageData,
  notifyActivityManagers
} = require('../../cloudfunctions/_shared/manager-notifications');

function createCollection(collectionName, dataByCollection, writes) {
  return {
    doc(id) {
      return {
        async get() {
          return {
            data: dataByCollection[id] || null
          };
        },
        async update({ data }) {
          writes.updates.push({
            collection: collectionName,
            id,
            data
          });

          if (dataByCollection[id]) {
            dataByCollection[id] = {
              ...dataByCollection[id],
              ...data
            };
          }

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
          let data = Object.values(dataByCollection).filter(item =>
            Object.entries(query).every(([key, expected]) => {
              if (expected && expected.gt !== undefined) {
                return String(item[key] || '') > String(expected.gt);
              }
              return item[key] === expected;
            })
          );

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
    adds: [],
    updates: []
  };
  const data = {
    users: seed.users || {},
    notification_subscriptions: seed.notificationSubscriptions || {},
    notification_logs: seed.notificationLogs || {}
  };

  return {
    writes,
    command: {
      gt(value) {
        return { gt: value };
      }
    },
    collection(name) {
      return createCollection(name, data[name], writes);
    }
  };
}

test('buildManagerRegistrationMessageData maps join and cancel changes to the manager notice template', () => {
  const activity = {
    title: 'May 9 training',
    joinedCount: 3,
    signupLimitTotal: 24
  };

  expect(
    buildManagerRegistrationMessageData(activity, {
      changeType: 'registration_joined',
      actorName: 'Alex',
      joinedCountAfter: 4
    })
  ).toEqual({
    thing7: {
      value: 'May 9 training'
    },
    phrase1: {
      value: '\u53c2\u4e0e\u8005\u52a0\u5165'
    },
    thing5: {
      value: 'Alex\u52a0\u5165\u62a5\u540d'
    },
    thing6: {
      value: '4/24'
    }
  });

  expect(
    buildManagerRegistrationMessageData(activity, {
      changeType: 'registration_cancelled',
      actorName: 'Alex',
      joinedCountAfter: 2
    })
  ).toEqual({
    thing7: {
      value: 'May 9 training'
    },
    phrase1: {
      value: '\u53c2\u4e0e\u8005\u9000\u51fa'
    },
    thing5: {
      value: 'Alex\u9000\u51fa\u62a5\u540d'
    },
    thing6: {
      value: '2/24'
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
      },
      openid_activity_only_manager: {
        _id: 'openid_activity_only_manager',
        roles: ['admin']
      }
    },
    notificationSubscriptions: {
      owner_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_owner',
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'accepted'
      },
      admin_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_admin',
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'accepted'
      },
      regular_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_regular',
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'accepted'
      },
      actor_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_player',
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'accepted'
      },
      activity_notice_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_activity_only_manager',
        templateKey: 'activity_notice',
        templateId: 'tmpl_activity',
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
        joinedCount: 3,
        signupLimitTotal: 12,
        organizerOpenId: 'openid_owner'
      },
      actorOpenId: 'openid_player',
      actorName: 'Alex',
      changeType: 'registration_joined',
      joinedCountAfter: 4,
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
  expect(sendSubscribeMessage.mock.calls.map(call => call[0].templateId)).toEqual([
    'tmpl_manager',
    'tmpl_manager'
  ]);
  expect(sendSubscribeMessage.mock.calls[0][0].data).toEqual({
    thing7: {
      value: 'May 9 training'
    },
    phrase1: {
      value: '\u53c2\u4e0e\u8005\u52a0\u5165'
    },
    thing5: {
      value: 'Alex\u52a0\u5165\u62a5\u540d'
    },
    thing6: {
      value: '4/12'
    }
  });
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
  expect(fakeDb.writes.updates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        collection: 'notification_subscriptions',
        id: 'activity_1_openid_owner_manager_registration_notice',
        data: expect.objectContaining({
          status: 'consumed',
          subscribed: false,
          consumedAt: '2026-05-09T10:00:00.000Z',
          lastSendStatus: 'sent'
        })
      }),
      expect.objectContaining({
        collection: 'notification_subscriptions',
        id: 'activity_1_openid_admin_manager_registration_notice',
        data: expect.objectContaining({
          status: 'consumed',
          subscribed: false,
          consumedAt: '2026-05-09T10:00:00.000Z',
          lastSendStatus: 'sent'
        })
      })
    ])
  );
});

test('notifyActivityManagers includes accepted managers beyond the first query page', async () => {
  const users = Object.fromEntries(
    Array.from({ length: 105 }, (_, index) => [
      `openid_manager_${index}`,
      {
        _id: `openid_manager_${index}`,
        roles: ['user', 'admin']
      }
    ])
  );
  const notificationSubscriptions = Object.fromEntries(
    Array.from({ length: 105 }, (_, index) => [
      `sub_${String(index).padStart(3, '0')}`,
      {
        _id: `sub_${String(index).padStart(3, '0')}`,
        activityId: 'activity_1',
        userOpenId: `openid_manager_${index}`,
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'accepted'
      }
    ])
  );
  const db = createFakeDb({ users, notificationSubscriptions });
  const sendSubscribeMessage = jest.fn().mockResolvedValue({ errCode: 0 });

  const result = await notifyActivityManagers(
    db,
    {
      activity: {
        _id: 'activity_1',
        title: 'Large Match',
        organizerOpenId: 'openid_owner',
        joinedCount: 105,
        signupLimitTotal: 120
      },
      actorOpenId: 'openid_actor',
      participantName: 'Player',
      changeType: 'registration_joined',
      stamp: '2026-05-01T10:00:00.000Z'
    },
    {
      sendSubscribeMessage,
      ensureNotificationCollections: jest.fn().mockResolvedValue({})
    }
  );

  expect(sendSubscribeMessage).toHaveBeenCalledTimes(105);
  expect(result.sent).toBe(105);
});

test('notifyActivityManagers consumes stale accepted subscriptions after send failures so managers can re-subscribe', async () => {
  const fakeDb = createFakeDb({
    notificationSubscriptions: {
      owner_sub: {
        activityId: 'activity_1',
        userOpenId: 'openid_owner',
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
        status: 'accepted'
      }
    }
  });
  const sendSubscribeMessage = jest.fn().mockRejectedValue(new Error('quota exhausted'));

  const result = await notifyActivityManagers(
    fakeDb,
    {
      activity: {
        _id: 'activity_1',
        title: 'May 9 training',
        organizerOpenId: 'openid_owner',
        joinedCount: 4,
        signupLimitTotal: 12
      },
      actorOpenId: 'openid_player',
      actorName: 'Alex',
      changeType: 'registration_cancelled',
      joinedCountAfter: 3,
      stamp: '2026-05-09T10:00:00.000Z'
    },
    {
      sendSubscribeMessage,
      ensureNotificationCollections: jest.fn().mockResolvedValue({})
    }
  );

  expect(result).toMatchObject({
    totalRecipients: 1,
    sent: 0,
    failed: 1
  });
  expect(fakeDb.writes.updates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        collection: 'notification_subscriptions',
        id: 'activity_1_openid_owner_manager_registration_notice',
        data: expect.objectContaining({
          status: 'consumed',
          subscribed: false,
          lastSendStatus: 'failed',
          lastErrorMessage: 'quota exhausted'
        })
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
        templateKey: 'manager_registration_notice',
        templateId: 'tmpl_manager',
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
