const recordNotificationSubscription = require('../../cloudfunctions/recordNotificationSubscription/index');

test('recordNotificationSubscription upserts the current user subscription choice', async () => {
  const setSubscription = jest.fn().mockResolvedValue({});
  const ensureNotificationCollections = jest.fn().mockResolvedValue({});
  let subscriptionDocumentId = '';
  const fakeDb = {
    collection: jest.fn(name => {
      if (name !== 'notification_subscriptions') {
        throw new Error(`Unexpected collection ${name}`);
      }

      return {
        doc: jest.fn(documentId => {
          subscriptionDocumentId = documentId;
          return {
            set: setSubscription
          };
        })
      };
    })
  };

  const result = await recordNotificationSubscription.main(
    {
      activityId: 'activity_1',
      templateKey: 'activity_notice',
      templateId: 'tmpl_123',
      status: 'accepted'
    },
    { OPENID: 'openid_player' },
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z',
      ensureNotificationCollections
    }
  );

  expect(ensureNotificationCollections).toHaveBeenCalledWith(fakeDb);
  expect(subscriptionDocumentId).toBe('activity_1_openid_player_activity_notice');
  expect(setSubscription).toHaveBeenCalledWith({
    data: {
      activityId: 'activity_1',
      userOpenId: 'openid_player',
      templateKey: 'activity_notice',
      templateId: 'tmpl_123',
      status: 'accepted',
      subscribed: true,
      updatedAt: '2026-04-19T10:00:00.000Z'
    }
  });
  expect(result).toEqual({
    activityId: 'activity_1',
    templateKey: 'activity_notice',
    status: 'accepted',
    subscribed: true
  });
});

test('recordNotificationSubscription normalizes rejected choices as declined', async () => {
  const setSubscription = jest.fn().mockResolvedValue({});
  const fakeDb = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: setSubscription
      }))
    }))
  };

  const result = await recordNotificationSubscription.main(
    {
      activityId: 'activity_1',
      templateKey: 'activity_notice',
      templateId: 'tmpl_123',
      status: 'reject'
    },
    { OPENID: 'openid_player' },
    {
      db: fakeDb,
      now: '2026-04-19T10:00:00.000Z'
    }
  );

  expect(setSubscription).toHaveBeenCalledWith({
    data: expect.objectContaining({
      status: 'declined',
      subscribed: false
    })
  });
  expect(result).toMatchObject({
    status: 'declined',
    subscribed: false
  });
});
