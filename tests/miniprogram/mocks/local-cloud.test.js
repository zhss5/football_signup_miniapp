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
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    description: '7v7 game',
    coverImage: 'wxfile://cover-1.png',
    imageList: ['wxfile://cover-1.png'],
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
  expect(list.items[0].signupDeadlineAt).toBe('2026-04-26T19:30:00.000Z');
  expect(list.items[0].imageList).toEqual(['wxfile://cover-1.png']);
});

test('local cloud client blocks regular users from creating activities when roles are restricted', async () => {
  const client = createLocalCloudClient({
    storage: createMemoryStorage(),
    now: () => '2026-04-19T10:00:00.000Z',
    openid: 'openid_regular',
    defaultRoles: ['user']
  });

  await expect(
    client.call('createActivity', {
      title: 'Saturday 8-10',
      startAt: '2026-04-26T20:00:00.000Z',
      endAt: '2026-04-26T22:00:00.000Z',
      signupDeadlineAt: '2026-04-26T19:30:00.000Z',
      addressText: 'Half Stone',
      description: '7v7 game',
      coverImage: '',
      imageList: [],
      signupLimitTotal: 12,
      requirePhone: false,
      inviteCode: '',
      teams: [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ]
    })
  ).rejects.toThrow('Only organizers can create activities');
});

test('local cloud client lets an organizer update an activity without changing registrations', async () => {
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
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    description: '',
    coverImage: '',
    imageList: [],
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

  await participantClient.call('joinActivity', {
    activityId: created.activityId,
    teamId: detailBefore.teams[0]._id,
    signupName: 'Alex',
    phone: '',
    source: 'share'
  });

  await ownerClient.call('updateActivity', {
    activityId: created.activityId,
    title: 'Updated Saturday',
    startAt: '2026-04-27T20:00:00.000Z',
    endAt: '2026-04-27T22:00:00.000Z',
    signupDeadlineAt: '2026-04-27T19:30:00.000Z',
    addressText: 'New Field',
    description: 'Updated notes',
    coverImage: '',
    imageList: [],
    signupLimitTotal: 16,
    requirePhone: true,
    inviteCode: 'NEW'
  });

  const detailAfter = await participantClient.call('getActivityDetail', {
    activityId: created.activityId
  });

  expect(detailAfter.activity).toMatchObject({
    _id: created.activityId,
    title: 'Updated Saturday',
    addressText: 'New Field',
    signupLimitTotal: 16,
    joinedCount: 1,
    requirePhone: true
  });
  expect(detailAfter.myRegistration).toMatchObject({
    activityId: created.activityId,
    signupName: 'Alex',
    status: 'joined'
  });
});

test('local cloud client blocks non-owner activity edits and capacity below joined count', async () => {
  const storage = createMemoryStorage();
  const ownerClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-19T10:00:00.000Z',
    openid: 'openid_owner'
  });
  const otherOrganizerClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-19T12:00:00.000Z',
    openid: 'openid_other'
  });

  const created = await ownerClient.call('createActivity', {
    title: 'Saturday 8-10',
    startAt: '2026-04-26T20:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    description: '',
    coverImage: '',
    imageList: [],
    signupLimitTotal: 12,
    requirePhone: false,
    inviteCode: '',
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ]
  });

  await expect(
    otherOrganizerClient.call('updateActivity', {
      activityId: created.activityId,
      title: 'Other edit',
      startAt: '2026-04-27T20:00:00.000Z',
      endAt: '2026-04-27T22:00:00.000Z',
      signupDeadlineAt: '2026-04-27T19:30:00.000Z',
      addressText: 'New Field',
      signupLimitTotal: 12,
      teams: [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ]
    })
  ).rejects.toThrow('Only the organizer or an admin can edit this activity');

  await expect(
    ownerClient.call('updateActivity', {
      activityId: created.activityId,
      title: 'Owner edit',
      startAt: '2026-04-27T20:00:00.000Z',
      endAt: '2026-04-27T22:00:00.000Z',
      signupDeadlineAt: '2026-04-27T19:30:00.000Z',
      addressText: 'New Field',
      signupLimitTotal: 1,
      teams: [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ]
    })
  ).rejects.toThrow('Total signup limit must cover all team slots');
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
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    description: '',
    coverImage: '',
    imageList: [],
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

test('local cloud client blocks switching teams before cancelling and exposes bench members', async () => {
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
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    addressName: 'Half Stone Football Park',
    location: {
      latitude: 31.2304,
      longitude: 121.4737
    },
    description: '',
    coverImage: '',
    imageList: [],
    signupLimitTotal: 20,
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

  await participantClient.call('joinActivity', {
    activityId: created.activityId,
    teamId: detailBefore.teams[0]._id,
    signupName: 'Alex',
    phone: '',
    source: 'share'
  });

  await expect(
    participantClient.call('joinActivity', {
      activityId: created.activityId,
      teamId: detailBefore.teams[1]._id,
      signupName: 'Alex',
      phone: '',
      source: 'share'
    })
  ).rejects.toThrow('You already joined this activity');

  const detailAfter = await participantClient.call('getActivityDetail', {
    activityId: created.activityId
  });

  expect(detailAfter.teams.map(item => item.teamName)).toEqual(['White', 'Red', '替补']);
  expect(detailAfter.teams[0].members[0]).toMatchObject({
    signupName: 'Alex',
    avatarUrl: ''
  });
  expect(detailAfter.myRegistration.teamId).toBe(detailBefore.teams[0]._id);
  expect(detailAfter.activity.signupDeadlineAt).toBe('2026-04-26T19:30:00.000Z');
});

test('local cloud client keeps soft-deleted activities in created history but hides them from home', async () => {
  const storage = createMemoryStorage();
  const ownerClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-19T10:00:00.000Z',
    openid: 'openid_owner'
  });

  const created = await ownerClient.call('createActivity', {
    title: 'Saturday 8-10',
    startAt: '2026-04-26T20:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    description: '',
    coverImage: '',
    imageList: [],
    signupLimitTotal: 12,
    requirePhone: false,
    inviteCode: '',
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ]
  });

  const cancelled = await ownerClient.call('cancelActivity', {
    activityId: created.activityId
  });

  const deleted = await ownerClient.call('deleteActivity', {
    activityId: created.activityId
  });

  const createdList = await ownerClient.call('listActivities', {
    scope: 'created'
  });
  const homeList = await ownerClient.call('listActivities', {
    scope: 'home'
  });

  expect(cancelled.status).toBe('cancelled');
  expect(deleted.status).toBe('deleted');
  expect(createdList.items).toHaveLength(1);
  expect(createdList.items[0].status).toBe('deleted');
  expect(homeList.items).toHaveLength(0);
});

test('local cloud client excludes deleted activities from joined activities and denies deleted detail to non-organizers', async () => {
  const storage = createMemoryStorage();
  const ownerClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-19T10:00:00.000Z',
    openid: 'openid_owner'
  });
  const playerClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-19T11:00:00.000Z',
    openid: 'openid_player'
  });

  const created = await ownerClient.call('createActivity', {
    title: 'Saturday 8-10',
    startAt: '2026-04-26T21:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    description: '',
    coverImage: '',
    imageList: [],
    signupLimitTotal: 12,
    requirePhone: false,
    inviteCode: '',
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ]
  });

  await ownerClient.call('deleteActivity', {
    activityId: created.activityId
  });

  const joinedList = await playerClient.call('listActivities', {
    scope: 'joined'
  });

  await expect(
    playerClient.call('getActivityDetail', {
      activityId: created.activityId
    })
  ).rejects.toThrow('Activity not found');

  expect(joinedList.items).toHaveLength(0);
});

test('local cloud client blocks signup cancellation after deadline', async () => {
  const storage = createMemoryStorage();
  const ownerClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-19T10:00:00.000Z',
    openid: 'openid_owner'
  });
  const participantClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-26T18:00:00.000Z',
    openid: 'openid_player'
  });
  const lateParticipantClient = createLocalCloudClient({
    storage,
    now: () => '2026-04-26T20:30:00.000Z',
    openid: 'openid_player'
  });

  const created = await ownerClient.call('createActivity', {
    title: 'Saturday 8-10',
    startAt: '2026-04-26T21:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    description: '',
    coverImage: '',
    imageList: [],
    signupLimitTotal: 12,
    requirePhone: false,
    inviteCode: '',
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ]
  });

  const detail = await participantClient.call('getActivityDetail', {
    activityId: created.activityId
  });

  await participantClient.call('joinActivity', {
    activityId: created.activityId,
    teamId: detail.teams[0]._id,
    signupName: 'Alex',
    phone: '',
    source: 'share'
  });

  await expect(
    lateParticipantClient.call('cancelRegistration', {
      activityId: created.activityId
    })
  ).rejects.toThrow('Signup can no longer be cancelled');
});
