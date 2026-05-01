jest.mock('../../../miniprogram/services/activity-service', () => ({
  createActivity: jest.fn(),
  getActivityDetail: jest.fn(),
  updateActivity: jest.fn()
}));

jest.mock('../../../miniprogram/services/cloud', () => ({
  uploadFile: jest.fn(filePath => Promise.resolve(filePath))
}));

jest.mock('../../../miniprogram/services/user-service', () => ({
  ensureUserProfile: jest.fn()
}));

jest.mock('../../../miniprogram/utils/activity-draft', () => ({
  buildActivityEditForm: jest.fn(() => ({
    title: 'Existing Thursday Match',
    coverImage: 'cloud://cover-existing',
    imageList: ['cloud://cover-existing']
  })),
  buildActivityPayload: jest.fn(form => form),
  createDefaultActivityForm: jest.fn(() => ({
    title: 'Thursday Match'
  })),
  summarizeTeamSlots: jest.fn(() => ({
    namedTeamSlots: 12,
    benchSlots: 0,
    overCapacity: false
  }))
}));

jest.mock('../../../miniprogram/utils/validators', () => ({
  validateActivityDraft: jest.fn()
}));

jest.mock('../../../miniprogram/utils/constants', () => ({
  MAX_ACTIVITY_IMAGES: 1,
  MAX_TEAMS: 4
}));

describe('activity create submit flow', () => {
  let pageConfig;
  let createActivity;
  let getActivityDetail;
  let updateActivity;
  let ensureUserProfile;
  let uploadFile;
  let validateActivityDraft;
  let app;

  beforeEach(() => {
    pageConfig = null;
    app = {
      globalData: {}
    };
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      navigateBack: jest.fn(),
      redirectTo: jest.fn(),
      showToast: jest.fn()
    };
    global.getApp = jest.fn(() => app);

    jest.resetModules();
    require('../../../miniprogram/pages/activity-create/index');
    ({
      createActivity,
      getActivityDetail,
      updateActivity
    } = require('../../../miniprogram/services/activity-service'));
    ({ ensureUserProfile } = require('../../../miniprogram/services/user-service'));
    ({ uploadFile } = require('../../../miniprogram/services/cloud'));
    ({ validateActivityDraft } = require('../../../miniprogram/utils/validators'));
  });

  test('onLoad marks the create page unavailable for regular users', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        roles: ['user']
      }
    });

    const ctx = {
      ...pageConfig,
      data: {
        ...pageConfig.data
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onLoad.call(ctx);

    expect(ensureUserProfile).toHaveBeenCalled();
    expect(ctx.data.authorizationChecked).toBe(true);
    expect(ctx.data.canCreateActivity).toBe(false);
  });

  test('onSubmit blocks users without create permission', async () => {
    const ctx = {
      data: {
        form: {
          title: 'Thursday Match'
        },
        canCreateActivity: false,
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: jest.fn()
    };

    await pageConfig.onSubmit.call(ctx);

    expect(createActivity).not.toHaveBeenCalled();
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Only organizers can create activities',
      icon: 'none'
    });
  });

  test('onSubmit redirects to detail with the post-publish share flag', async () => {
    createActivity.mockResolvedValue({ activityId: 'activity_123' });

    const ctx = {
      data: {
        form: {
          title: 'Thursday Match'
        },
        canCreateActivity: true
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: jest.fn()
    };

    await pageConfig.onSubmit.call(ctx);

    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/pages/activity-detail/index?activityId=activity_123&fromPublish=1'
    });
  });

  test('onLoad in edit mode loads the existing activity into the form when the viewer can edit', async () => {
    getActivityDetail.mockResolvedValue({
      activity: {
        _id: 'activity_123',
        title: 'Existing Thursday Match'
      },
      teams: [],
      viewer: {
        canEditActivity: true
      }
    });

    const ctx = {
      ...pageConfig,
      data: {
        ...pageConfig.data
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onLoad.call(ctx, {
      mode: 'edit',
      activityId: 'activity_123'
    });

    expect(getActivityDetail).toHaveBeenCalledWith('activity_123');
    expect(ctx.data.isEditMode).toBe(true);
    expect(ctx.data.canEditActivity).toBe(true);
    expect(ctx.data.form.title).toBe('Existing Thursday Match');
  });

  test('onSubmit updates an existing activity in edit mode without reuploading a CloudBase cover', async () => {
    updateActivity.mockResolvedValue({ activityId: 'activity_123' });

    const ctx = {
      data: {
        form: {
          title: 'Updated Thursday Match',
          coverImage: 'cloud://cover-existing',
          imageList: ['cloud://cover-existing']
        },
        canSubmitActivity: true,
        isEditMode: true,
        editActivityId: 'activity_123'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: jest.fn()
    };

    await pageConfig.onSubmit.call(ctx);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(updateActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'activity_123',
        title: 'Updated Thursday Match',
        coverImage: 'cloud://cover-existing'
      })
    );
    expect(createActivity).not.toHaveBeenCalled();
    expect(app.globalData.activityDetailRefreshFlags).toMatchObject({
      activity_123: true
    });
    expect(global.wx.navigateBack).toHaveBeenCalledWith({ delta: 1 });
    expect(global.wx.redirectTo).not.toHaveBeenCalled();
  });

  test('manual address edits clear stale map pin metadata', () => {
    const ctx = {
      data: {
        form: {
          addressText: 'Old address',
          addressName: 'Old field',
          location: {
            latitude: 31.2,
            longitude: 121.4
          }
        },
        validationErrors: {},
        locale: 'en-US'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: pageConfig.syncDerivedState
    };

    pageConfig.onFieldInput.call(ctx, {
      currentTarget: {
        dataset: {
          field: 'addressText'
        }
      },
      detail: {
        value: 'Old address 123'
      }
    });

    expect(ctx.data.form).toMatchObject({
      addressText: 'Old address 123',
      addressName: '',
      location: null
    });
    expect(ctx.data.selectedPinText).toBe('');
  });

  test('onSubmit uploads a selected cover before creating the activity', async () => {
    uploadFile.mockImplementation((filePath, cloudPath) => {
      if (cloudPath.startsWith('activity-cover-thumbs/')) {
        return Promise.resolve('cloud://prod-env-123/activity-cover-thumbs/cover-thumb.jpg');
      }

      return Promise.resolve('cloud://prod-env-123/activity-covers/cover.jpg');
    });
    createActivity.mockResolvedValue({ activityId: 'activity_123' });

    const ctx = {
      data: {
        form: {
          title: 'Thursday Match',
          coverImage: 'wxfile://tmp_cover.jpg',
          coverThumbImage: 'wxfile://tmp_cover_thumb.jpg',
          imageList: ['wxfile://tmp_cover.jpg']
        },
        canCreateActivity: true
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: jest.fn()
    };

    await pageConfig.onSubmit.call(ctx);

    expect(uploadFile).toHaveBeenCalledWith(
      'wxfile://tmp_cover.jpg',
      expect.stringMatching(/^activity-covers\/.+\.jpg$/)
    );
    expect(uploadFile).toHaveBeenCalledWith(
      'wxfile://tmp_cover_thumb.jpg',
      expect.stringMatching(/^activity-cover-thumbs\/.+\.jpg$/)
    );
    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
        coverThumbImage: 'cloud://prod-env-123/activity-cover-thumbs/cover-thumb.jpg',
        imageList: ['cloud://prod-env-123/activity-covers/cover.jpg']
      })
    );
  });

  test('onSubmit highlights the location input when address validation fails', async () => {
    validateActivityDraft.mockImplementation(() => {
      throw new Error('Activity address is required');
    });

    const ctx = {
      data: {
        form: {
          title: 'Thursday Match'
        },
        validationErrors: {},
        canCreateActivity: true
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: jest.fn()
    };

    await pageConfig.onSubmit.call(ctx);

    expect(ctx.data.validationErrors).toMatchObject({
      addressText: 'Activity address is required'
    });
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Activity address is required',
      icon: 'none'
    });
  });
});
