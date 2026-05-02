jest.mock('../../../miniprogram/services/cloud', () => ({
  call: jest.fn(),
  resolveFileUrls: jest.fn()
}));

describe('activity service cover display urls', () => {
  let resolveFileUrls;
  let activityService;

  beforeEach(() => {
    jest.resetModules();
    ({ resolveFileUrls } = require('../../../miniprogram/services/cloud'));
    resolveFileUrls.mockResolvedValue({
      'cloud://prod-env-123/activity-covers/thumb.jpg': 'https://tmp.example.com/thumb.jpg',
      'cloud://prod-env-123/activity-covers/cover.jpg': 'https://tmp.example.com/cover.jpg'
    });
    activityService = require('../../../miniprogram/services/activity-service');
  });

  test('resolves list card cover images without replacing stored coverImage values', async () => {
    await expect(
      activityService.resolveActivityCoverImages([
        {
          _id: 'activity_1',
          coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg'
        }
      ])
    ).resolves.toEqual([
      {
        _id: 'activity_1',
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
        coverDisplayImage: 'https://tmp.example.com/cover.jpg',
        coverImageSources: [
          'https://tmp.example.com/cover.jpg',
          'cloud://prod-env-123/activity-covers/cover.jpg'
        ]
      }
    ]);
  });

  test('prefers resolved thumbnails for list cards when coverThumbImage exists', async () => {
    const [activity] = await activityService.resolveActivityCoverImages([
      {
        _id: 'activity_1',
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
        coverThumbImage: 'cloud://prod-env-123/activity-covers/thumb.jpg'
      }
    ]);

    expect(activity).toMatchObject({
      coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
      coverThumbImage: 'cloud://prod-env-123/activity-covers/thumb.jpg',
      coverDisplayImage: 'https://tmp.example.com/thumb.jpg',
      coverImageSources: [
        'https://tmp.example.com/thumb.jpg',
        'cloud://prod-env-123/activity-covers/thumb.jpg',
        'https://tmp.example.com/cover.jpg',
        'cloud://prod-env-123/activity-covers/cover.jpg'
      ]
    });
    expect(resolveFileUrls).toHaveBeenCalledWith([
      'cloud://prod-env-123/activity-covers/thumb.jpg',
      'cloud://prod-env-123/activity-covers/cover.jpg'
    ]);
  });

  test('falls back to original cover for list cards when thumbnail cannot be resolved', async () => {
    resolveFileUrls.mockResolvedValue({
      'cloud://prod-env-123/activity-covers/thumb.jpg':
        'cloud://prod-env-123/activity-covers/thumb.jpg',
      'cloud://prod-env-123/activity-covers/cover.jpg': 'https://tmp.example.com/cover.jpg'
    });

    const [activity] = await activityService.resolveActivityCoverImages([
      {
        _id: 'activity_1',
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
        coverThumbImage: 'cloud://prod-env-123/activity-covers/thumb.jpg'
      }
    ]);

    expect(activity.coverDisplayImage).toBe('https://tmp.example.com/cover.jpg');
    expect(resolveFileUrls).toHaveBeenCalledWith([
      'cloud://prod-env-123/activity-covers/thumb.jpg',
      'cloud://prod-env-123/activity-covers/cover.jpg'
    ]);
  });

  test('prefers original cover for detail pages when both cover images exist', async () => {
    const activity = await activityService.resolveActivityCoverImage({
      _id: 'activity_1',
      coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
      coverThumbImage: 'cloud://prod-env-123/activity-covers/thumb.jpg'
    });

    expect(activity.coverDisplayImage).toBe('https://tmp.example.com/cover.jpg');
    expect(resolveFileUrls).toHaveBeenCalledWith([
      'cloud://prod-env-123/activity-covers/cover.jpg',
      'cloud://prod-env-123/activity-covers/thumb.jpg'
    ]);
  });

  test('falls back to thumbnail for detail pages when original cover cannot be resolved', async () => {
    resolveFileUrls.mockResolvedValue({
      'cloud://prod-env-123/activity-covers/cover.jpg':
        'cloud://prod-env-123/activity-covers/cover.jpg',
      'cloud://prod-env-123/activity-covers/thumb.jpg': 'https://tmp.example.com/thumb.jpg'
    });

    const activity = await activityService.resolveActivityCoverImage({
      _id: 'activity_1',
      coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
      coverThumbImage: 'cloud://prod-env-123/activity-covers/thumb.jpg'
    });

    expect(activity.coverDisplayImage).toBe('https://tmp.example.com/thumb.jpg');
    expect(resolveFileUrls).toHaveBeenCalledWith([
      'cloud://prod-env-123/activity-covers/cover.jpg',
      'cloud://prod-env-123/activity-covers/thumb.jpg'
    ]);
  });

  test('does not expose unresolved CloudBase file ids as display image urls', async () => {
    resolveFileUrls.mockResolvedValue({
      'cloud://prod-env-123/activity-covers/cover.jpg':
        'cloud://prod-env-123/activity-covers/cover.jpg'
    });

    await expect(
      activityService.resolveActivityCoverImages([
        {
          _id: 'activity_1',
          coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg'
        }
      ])
    ).resolves.toEqual([
      {
        _id: 'activity_1',
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
        coverDisplayImage: '',
        coverImageSources: ['cloud://prod-env-123/activity-covers/cover.jpg']
      }
    ]);
  });

  test('keeps direct CloudBase file ids as fallback image sources when temporary urls fail', async () => {
    resolveFileUrls.mockResolvedValue({
      'cloud://prod-env-123/activity-covers/thumb.jpg':
        'cloud://prod-env-123/activity-covers/thumb.jpg',
      'cloud://prod-env-123/activity-covers/cover.jpg':
        'cloud://prod-env-123/activity-covers/cover.jpg'
    });

    const [activity] = await activityService.resolveActivityCoverImages([
      {
        _id: 'activity_1',
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
        coverThumbImage: 'cloud://prod-env-123/activity-covers/thumb.jpg'
      }
    ]);

    expect(activity.coverDisplayImage).toBe('');
    expect(activity.coverImageSources).toEqual([
      'cloud://prod-env-123/activity-covers/thumb.jpg',
      'cloud://prod-env-123/activity-covers/cover.jpg'
    ]);
  });
});
