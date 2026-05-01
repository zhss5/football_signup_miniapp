const generateActivityCoverThumbs = require('../../cloudfunctions/generateActivityCoverThumbs/index');

function createFakeDb(options = {}) {
  const state = {
    users: {
      openid_admin: { _id: 'openid_admin', roles: ['admin'] },
      openid_organizer: { _id: 'openid_organizer', roles: ['organizer'] },
      ...(options.users || {})
    },
    activities: {
      activity_1: {
        _id: 'activity_1',
        coverImage: 'cloud://prod-env-123/activity-covers/cover-1.jpg',
        status: 'published'
      },
      activity_2: {
        _id: 'activity_2',
        coverImage: 'cloud://prod-env-123/activity-covers/cover-2.jpg',
        coverThumbImage: 'cloud://prod-env-123/activity-cover-thumbs/cover-2.jpg',
        status: 'published'
      },
      activity_3: {
        _id: 'activity_3',
        coverImage: 'wxfile://tmp-cover.jpg',
        status: 'published'
      },
      activity_4: {
        _id: 'activity_4',
        coverImage: '',
        status: 'published'
      },
      ...(options.activities || {})
    }
  };

  return {
    state,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'users') {
                return { data: state.users[id] || null };
              }

              if (name === 'activities') {
                return { data: state.activities[id] || null };
              }

              throw new Error(`Unsupported doc get: ${name}`);
            },
            async update({ data }) {
              if (name !== 'activities') {
                throw new Error(`Unsupported update: ${name}`);
              }

              state.activities[id] = {
                ...state.activities[id],
                ...data
              };
              return { updated: 1 };
            }
          };
        },
        limit() {
          return {
            async get() {
              if (name !== 'activities') {
                throw new Error(`Unsupported limited get: ${name}`);
              }

              return { data: Object.values(state.activities) };
            }
          };
        }
      };
    }
  };
}

test('generateActivityCoverThumbs rejects non-admin users', async () => {
  await expect(
    generateActivityCoverThumbs.main(
      {},
      { OPENID: 'openid_organizer' },
      { db: createFakeDb(), now: '2026-05-01T10:00:00.000Z' }
    )
  ).rejects.toThrow('Only admins can generate activity cover thumbnails');
});

test('generateActivityCoverThumbs dry-run reports only activities that need thumbnails', async () => {
  const thumbnailProcessor = {
    createThumbnail: jest.fn()
  };

  const result = await generateActivityCoverThumbs.main(
    { dryRun: true, limit: 20 },
    { OPENID: 'openid_admin' },
    {
      db: createFakeDb(),
      now: '2026-05-01T10:00:00.000Z',
      thumbnailProcessor
    }
  );

  expect(result).toMatchObject({
    dryRun: true,
    scanned: 4,
    candidates: 1,
    processed: 0,
    failed: 0
  });
  expect(result.items).toEqual([
    expect.objectContaining({
      activityId: 'activity_1',
      sourceFileId: 'cloud://prod-env-123/activity-covers/cover-1.jpg'
    })
  ]);
  expect(thumbnailProcessor.createThumbnail).not.toHaveBeenCalled();
});

test('generateActivityCoverThumbs writes generated thumbnail file ids back to activities', async () => {
  const db = createFakeDb();
  const thumbnailProcessor = {
    createThumbnail: jest.fn().mockResolvedValue(
      'cloud://prod-env-123/activity-cover-thumbs/activity-1.jpg'
    )
  };

  const result = await generateActivityCoverThumbs.main(
    { limit: 20 },
    { OPENID: 'openid_admin' },
    {
      db,
      now: '2026-05-01T10:00:00.000Z',
      thumbnailProcessor
    }
  );

  expect(result).toMatchObject({
    dryRun: false,
    candidates: 1,
    processed: 1,
    failed: 0
  });
  expect(thumbnailProcessor.createThumbnail).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceFileId: 'cloud://prod-env-123/activity-covers/cover-1.jpg',
      outputCloudPath: expect.stringMatching(/^activity-cover-thumbs\/activity_1-/)
    })
  );
  expect(db.state.activities.activity_1).toMatchObject({
    coverThumbImage: 'cloud://prod-env-123/activity-cover-thumbs/activity-1.jpg',
    coverThumbGeneratedAt: '2026-05-01T10:00:00.000Z'
  });
});

test('generateActivityCoverThumbs force regenerates existing thumbnails', async () => {
  const db = createFakeDb();
  const thumbnailProcessor = {
    createThumbnail: jest.fn().mockResolvedValue(
      'cloud://prod-env-123/activity-cover-thumbs/activity-2-new.jpg'
    )
  };

  const result = await generateActivityCoverThumbs.main(
    { force: true, limit: 20 },
    { OPENID: 'openid_admin' },
    {
      db,
      now: '2026-05-01T10:00:00.000Z',
      thumbnailProcessor
    }
  );

  expect(result.candidates).toBe(2);
  expect(result.processed).toBe(2);
  expect(db.state.activities.activity_2.coverThumbImage).toBe(
    'cloud://prod-env-123/activity-cover-thumbs/activity-2-new.jpg'
  );
});
