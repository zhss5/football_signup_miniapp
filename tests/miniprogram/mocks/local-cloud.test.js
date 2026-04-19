const { createLocalCloudClient } = require('../../../miniprogram/mocks/local-cloud');

function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

test('local cloud client can create an activity and list it on home', async () => {
  const client = createLocalCloudClient({
    storage: createMemoryStorage(),
    now: () => '2026-04-19T10:00:00.000Z',
    openid: 'openid_owner'
  });

  const created = await client.call('createActivity', {
    title: 'Saturday 8-10',
    startAt: '2026-04-26T20:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
    addressText: 'Half Stone',
    description: '7v7 game',
    coverImage: '',
    signupLimitTotal: 12,
    requirePhone: false,
    inviteCode: '',
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ]
  });

  const list = await client.call('listActivities', {
    scope: 'home',
    status: 'published'
  });

  expect(created.activityId).toBeTruthy();
  expect(list.items).toHaveLength(1);
  expect(list.items[0].title).toBe('Saturday 8-10');
});

test('local cloud client can join and cancel an activity', async () => {
  const storage = createMemoryStorage();
  const ownerClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-19T10:00:00.000Z',
    openid: 'openid_owner'
  });

  const participantClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-19T11:00:00.000Z',
    openid: 'openid_player'
  });

  const created = await ownerClient.call('createActivity', {
    title: 'Saturday 8-10',
    startAt: '2026-04-26T20:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
    addressText: 'Half Stone',
    description: '',
    coverImage: '',
    signupLimitTotal: 12,
    requirePhone: false,
    inviteCode: '',
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ]
  });

  const detailBefore = await participantClient.call('getActivityDetail', {
    activityId: created.activityId
  });

  const joined = await participantClient.call('joinActivity', {
    activityId: created.activityId,
    teamId: detailBefore.teams[0]._id,
    signupName: 'Alex',
    phone: '',
    source: 'share'
  });

  const cancelled = await participantClient.call('cancelRegistration', {
    activityId: created.activityId
  });

  expect(joined.status).toBe('joined');
  expect(cancelled.status).toBe('cancelled');
});
