const createActivity = require('../../cloudfunctions/createActivity/index');

function createFakeDbWithUserRoles(roles, writes = []) {
  return {
    collection: jest.fn(name => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              data: {
                _id: 'openid_a',
                roles
              }
            })
          }))
        };
      }

      return {
        add: jest.fn(async ({ data }) => {
          writes.push({ name, data });
          return { _id: name === 'activities' ? 'activity_1' : `${name}_${writes.length}` };
        })
      };
    })
  };
}

function buildCreatePayload(overrides = {}) {
  return {
    title: 'Saturday 8-10',
    startAt: '2026-04-26T20:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    signupLimitTotal: 12,
    imageList: [],
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ],
    ...overrides
  };
}

test('createActivity rejects regular users before writing activity data', async () => {
  const writes = [];
  const fakeDb = createFakeDbWithUserRoles(['user'], writes);

  await expect(
    createActivity.main(
      {
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        requirePhone: false,
        imageList: [],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      },
      { OPENID: 'openid_a' },
      { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
    )
  ).rejects.toThrow('Only organizers can create activities');

  expect(writes).toEqual([]);
});

test('createActivity stores activity and teams', async () => {
  const writes = [];
  const fakeDb = createFakeDbWithUserRoles(['user', 'organizer'], writes);

  const result = await createActivity.main(
    {
      title: 'Saturday 8-10',
      startAt: '2026-04-26T20:00:00.000Z',
      endAt: '2026-04-26T22:00:00.000Z',
      signupDeadlineAt: '2026-04-26T19:30:00.000Z',
      activityType: 'external',
      addressText: 'Half Stone',
      signupLimitTotal: 12,
      requirePhone: false,
      imageList: [],
      teams: [
        { teamName: 'White', maxMembers: 6, colorKey: 'green' },
        { teamName: 'Red', maxMembers: 6, colorKey: 'red' }
      ]
    },
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  expect(result.activityId).toBe('activity_1');
  expect(writes[0].data.activityType).toBe('external');
  expect(writes[0].data.registrationNoticeThreshold).toBe(10);
  expect(writes.filter(item => item.name === 'activity_teams')).toHaveLength(2);
  expect(writes.filter(item => item.name === 'activity_teams').map(item => item.data.colorKey)).toEqual([
    'green',
    'red'
  ]);
});

test('createActivity defaults missing activityType to internal and rejects invalid values', async () => {
  const writes = [];
  const fakeDb = createFakeDbWithUserRoles(['organizer'], writes);
  const basePayload = {
    title: 'Saturday 8-10',
    startAt: '2026-04-26T20:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    addressText: 'Half Stone',
    signupLimitTotal: 12,
    imageList: [],
    teams: [
      { teamName: 'White', maxMembers: 6 },
      { teamName: 'Red', maxMembers: 6 }
    ]
  };

  await createActivity.main(
    basePayload,
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  expect(writes[0].data.activityType).toBe('internal');

  await expect(
    createActivity.main(
      {
        ...basePayload,
        activityType: 'league'
      },
      { OPENID: 'openid_a' },
      { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
    )
  ).rejects.toThrow('Invalid activity type');
});

test('createActivity persists a validated late cancellation notice window with a six hour default', async () => {
  const defaultWrites = [];
  await createActivity.main(
    buildCreatePayload(),
    { OPENID: 'openid_a' },
    {
      db: createFakeDbWithUserRoles(['organizer'], defaultWrites),
      now: '2026-04-19T10:00:00.000Z'
    }
  );
  expect(defaultWrites[0].data.lateCancellationNoticeWindowHours).toBe(6);

  for (const hours of [0, 168]) {
    const writes = [];
    await createActivity.main(
      buildCreatePayload({ lateCancellationNoticeWindowHours: hours }),
      { OPENID: 'openid_a' },
      {
        db: createFakeDbWithUserRoles(['organizer'], writes),
        now: '2026-04-19T10:00:00.000Z'
      }
    );
    expect(writes[0].data.lateCancellationNoticeWindowHours).toBe(hours);
  }
});

test.each([-1, 1.5, 169, 'six'])(
  'createActivity rejects invalid late cancellation notice window %p',
  async lateCancellationNoticeWindowHours => {
    const writes = [];
    await expect(
      createActivity.main(
        buildCreatePayload({ lateCancellationNoticeWindowHours }),
        { OPENID: 'openid_a' },
        {
          db: createFakeDbWithUserRoles(['organizer'], writes),
          now: '2026-04-19T10:00:00.000Z'
        }
      )
    ).rejects.toThrow('Late cancellation notice window must be an integer between 0 and 168 hours');
    expect(writes).toEqual([]);
  }
);

test('createActivity stores map location, deadline, image list, and auto generates a bench team', async () => {
  const writes = [];
  const fakeDb = createFakeDbWithUserRoles(['admin'], writes);

  await createActivity.main(
    {
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
      coverImage: 'cloud://football/cover-1.png',
      coverThumbImage: 'cloud://football/thumb-1.jpg',
      shareImage: 'cloud://football/share-1.jpg',
      imageList: ['cloud://football/cover-1.png'],
      detailImages: ['cloud://football/detail-1.jpg', 'cloud://football/detail-2.jpg'],
      insuranceLink: ' https://insurance.example.com/apply ',
      notificationHint: ' 请提前10分钟到场 ',
      registrationNoticeThreshold: 16,
      signupLimitTotal: 20,
      requirePhone: true,
      teams: [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ]
    },
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  expect(writes[0].data).toMatchObject({
    addressText: 'Half Stone',
    addressName: 'Half Stone Football Park',
    location: {
      latitude: 31.2304,
      longitude: 121.4737
    },
    signupDeadlineAt: '2026-04-26T19:30:00.000Z',
    coverImage: 'cloud://football/cover-1.png',
    coverThumbImage: 'cloud://football/thumb-1.jpg',
    shareImage: 'cloud://football/share-1.jpg',
    imageList: ['cloud://football/cover-1.png'],
    detailImages: ['cloud://football/detail-1.jpg', 'cloud://football/detail-2.jpg'],
    insuranceLink: 'https://insurance.example.com/apply',
    notificationHint: '请提前10分钟到场',
    registrationNoticeThreshold: 16,
    signupLimitTotal: 20,
    requirePhone: false
  });
  expect(writes[0].data).toMatchObject({
    confirmStatus: 'pending',
    confirmedAt: '',
    confirmedByOpenId: ''
  });

  const teamWrites = writes.filter(item => item.name === 'activity_teams');
  expect(teamWrites).toHaveLength(3);
  expect(teamWrites[2].data).toMatchObject({
    teamName: '替补',
    maxMembers: 8,
    teamType: 'bench',
    autoGenerated: true
  });
});

test('createActivity computes total capacity from regular teams and explicit bench capacity', async () => {
  const writes = [];
  const fakeDb = createFakeDbWithUserRoles(['organizer'], writes);

  await createActivity.main(
    {
      title: 'Saturday 8-10',
      startAt: '2026-04-26T20:00:00.000Z',
      endAt: '2026-04-26T22:00:00.000Z',
      signupDeadlineAt: '2026-04-26T19:30:00.000Z',
      addressText: 'Half Stone',
      signupLimitTotal: 99,
      benchCapacity: 3,
      imageList: [],
      teams: [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ]
    },
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  expect(writes[0].data.signupLimitTotal).toBe(15);
  expect(writes.filter(item => item.name === 'activity_teams')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({
          teamName: '替补',
          maxMembers: 3,
          teamType: 'bench'
        })
      })
    ])
  );
});

test('createActivity rejects more than five detail images', async () => {
  const writes = [];
  const fakeDb = createFakeDbWithUserRoles(['organizer'], writes);

  await expect(
    createActivity.main(
      {
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        signupLimitTotal: 12,
        imageList: ['cloud://football/cover-1.png'],
        detailImages: [
          'cloud://football/detail-1.jpg',
          'cloud://football/detail-2.jpg',
          'cloud://football/detail-3.jpg',
          'cloud://football/detail-4.jpg',
          'cloud://football/detail-5.jpg',
          'cloud://football/detail-6.jpg'
        ],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      },
      { OPENID: 'openid_a' },
      { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
    )
  ).rejects.toThrow('Up to five detail images are supported');

  expect(writes).toEqual([]);
});

test('createActivity rejects activity descriptions longer than 2000 characters', async () => {
  const writes = [];
  const fakeDb = createFakeDbWithUserRoles(['organizer'], writes);

  await expect(
    createActivity.main(
      {
        title: 'Saturday 8-10',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        signupDeadlineAt: '2026-04-26T19:30:00.000Z',
        addressText: 'Half Stone',
        description: 'a'.repeat(2001),
        signupLimitTotal: 12,
        imageList: ['cloud://football/cover-1.png'],
        teams: [
          { teamName: 'White', maxMembers: 6 },
          { teamName: 'Red', maxMembers: 6 }
        ]
      },
      { OPENID: 'openid_a' },
      { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
    )
  ).rejects.toThrow('Activity description supports up to 2000 characters');

  expect(writes).toEqual([]);
});
