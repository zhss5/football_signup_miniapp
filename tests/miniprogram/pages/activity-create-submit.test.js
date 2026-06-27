const fs = require('fs');
const path = require('path');

jest.mock('../../../miniprogram/services/activity-service', () => ({
  createActivity: jest.fn(),
  getActivityCopyDraft: jest.fn(),
  getActivityDetail: jest.fn(),
  updateActivity: jest.fn()
}));

jest.mock('../../../miniprogram/services/cloud', () => ({
  uploadFile: jest.fn(filePath => Promise.resolve(filePath))
}));

jest.mock('../../../miniprogram/services/user-service', () => ({
  ensureUserProfile: jest.fn()
}));

jest.mock('../../../miniprogram/services/notification-service', () => ({
  recordActivityNotificationSubscription: jest.fn(),
  requestManagerRegistrationNotificationSubscriptionConsent: jest.fn()
}));

jest.mock('../../../miniprogram/utils/activity-draft', () => {
  function formatSourceTime(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  return {
    buildActivityCopyForm: jest.fn(draft => ({
      title: draft.title || '',
      activityDate: '',
      startTime: formatSourceTime(draft.sourceStartAt || draft.startAt),
      endTime: formatSourceTime(draft.sourceEndAt || draft.endAt),
      signupDeadlineDate: '',
      signupDeadlineTime: formatSourceTime(draft.sourceSignupDeadlineAt || draft.signupDeadlineAt),
      addressText: draft.addressText || '',
      teams: draft.teams || []
    })),
    buildActivityEditForm: jest.fn(() => ({
      title: 'Existing Thursday Match',
      coverImage: 'cloud://cover-existing',
      imageList: ['cloud://cover-existing']
    })),
    buildActivityPayload: jest.fn(form => form),
    createDefaultActivityForm: jest.fn(() => ({
      title: 'Thursday Match'
    })),
    getDefaultRegistrationNoticeThreshold: jest.fn(total =>
      Number(total || 0) > 0 ? Math.ceil(Number(total || 0) * 0.8) : 0
    ),
    normalizeNotificationHint: jest.fn(value => {
      const text = String(value || '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim();
      return Array.from(text).slice(0, 20).join('');
    }),
    summarizeTeamSlots: jest.fn(() => ({
      namedTeamSlots: 12,
      benchSlots: 0,
      overCapacity: false
    }))
  };
});

jest.mock('../../../miniprogram/utils/validators', () => ({
  validateActivityDraft: jest.fn()
}));

jest.mock('../../../miniprogram/utils/constants', () => ({
  MAX_ACTIVITY_IMAGES: 1,
  MAX_DETAIL_IMAGES: 5,
  MAX_TEAMS: 4
}));

describe('activity create submit flow', () => {
  let pageConfig;
  let createActivity;
  let getActivityCopyDraft;
  let getActivityDetail;
  let updateActivity;
  let ensureUserProfile;
  let uploadFile;
  let validateActivityDraft;
  let recordActivityNotificationSubscription;
  let requestManagerRegistrationNotificationSubscriptionConsent;
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
      getActivityCopyDraft,
      getActivityDetail,
      updateActivity
    } = require('../../../miniprogram/services/activity-service'));
    ({ ensureUserProfile } = require('../../../miniprogram/services/user-service'));
    ({ uploadFile } = require('../../../miniprogram/services/cloud'));
    ({
      recordActivityNotificationSubscription,
      requestManagerRegistrationNotificationSubscriptionConsent
    } = require('../../../miniprogram/services/notification-service'));
    ({ validateActivityDraft } = require('../../../miniprogram/utils/validators'));
    requestManagerRegistrationNotificationSubscriptionConsent.mockResolvedValue({
      configured: false,
      skipped: true
    });
    recordActivityNotificationSubscription.mockResolvedValue({ skipped: true });
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

  test('does not expose the legacy phone requirement control', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );

    expect(pageConfig.onRequirePhoneChange).toBeUndefined();
    expect(wxml).not.toContain('requirePhone');
    expect(wxml).not.toContain('onRequirePhoneChange');
  });

  test('renders an optional insurance link field', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('data-field="insuranceLink"');
    expect(wxml).toContain('{{i18n.activityCreate.insuranceLink}}');
    expect(wxml).toContain('{{i18n.activityCreate.activityType}}');
    expect(wxml).toContain('bindchange="onActivityTypeChange"');
  });

  test('hides the reserved invite code field until invite-code enforcement is implemented', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );

    expect(wxml).not.toContain('data-field="inviteCode"');
    expect(wxml).not.toContain('{{i18n.activityCreate.inviteCode}}');
    expect(wxml).not.toContain('{{i18n.activityCreate.inviteCodePlaceholder}}');
  });

  test('renders an optional notification hint field for confirmation notices', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('data-field="notificationHint"');
    expect(wxml).toContain('{{i18n.activityCreate.notificationHint}}');
    expect(wxml).toMatch(
      /<input[\s\S]*data-field="notificationHint"[\s\S]*maxlength="20"[\s\S]*\/>/
    );
    expect(wxml).not.toMatch(/<textarea[\s\S]*data-field="notificationHint"/);
  });

  test('groups notification-only settings together before display content', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxss'),
      'utf8'
    );

    const teamEditorIndex = wxml.indexOf('<team-editor');
    const totalSignupIndex = wxml.indexOf('data-field="signupLimitTotal"');
    const notificationSettingsIndex = wxml.indexOf('{{i18n.activityCreate.notificationSettings}}');
    const notificationSettingsHintIndex = wxml.indexOf(
      '{{i18n.activityCreate.notificationSettingsHint}}'
    );
    const notificationHintIndex = wxml.indexOf('data-field="notificationHint"');
    const registrationNoticeIndex = wxml.indexOf('data-field="registrationNoticeThreshold"');
    const coverImageIndex = wxml.indexOf('{{i18n.activityCreate.coverImage}}');

    expect(wxml).toContain('class="notification-settings-group"');
    expect(teamEditorIndex).toBeGreaterThan(-1);
    expect(totalSignupIndex).toBeGreaterThan(teamEditorIndex);
    expect(notificationSettingsIndex).toBeGreaterThan(totalSignupIndex);
    expect(notificationSettingsHintIndex).toBeGreaterThan(notificationSettingsIndex);
    expect(registrationNoticeIndex).toBeGreaterThan(notificationSettingsHintIndex);
    expect(notificationHintIndex).toBeGreaterThan(registrationNoticeIndex);
    expect(coverImageIndex).toBeGreaterThan(notificationHintIndex);
    expect(wxss).toContain('.notification-settings-group');
    expect(wxss).toContain('.notification-settings-group .input');
  });

  test('renders the team editor when editing an existing activity', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('<team-editor');
    expect(wxml).toContain('teams="{{form.teams}}"');
    expect(wxml).not.toContain('<team-editor wx:if="{{!isEditMode}}"');
  });

  test('lets the cover image frame open the chooser without a separate choose button', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('class="image-preview-frame"');
    expect(wxml).toContain('bindtap="onChooseActivityImage"');
    expect(wxml).not.toContain('chooseAndCropImage');
    expect(wxml).not.toContain('replaceImage');
  });

  test('renders a separate detail image uploader capped at five images', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('{{i18n.activityCreate.coverImage}}');
    expect(wxml).toContain('{{i18n.activityCreate.detailImages}}');
    expect(wxml).toContain('wx:for="{{form.detailImages}}"');
    expect(wxml).toContain('bindtap="onChooseDetailImages"');
    expect(wxml).toContain('bindtap="onRemoveDetailImage"');
  });

  test('team member fallback avatars use the team color class', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain('member-avatar-fallback {{item.teamColorClass}}');
    expect(wxml).toContain('member-avatar-fallback-bordered');
    expect(wxss).toContain('.member-avatar-fallback.team-color-red');
    expect(wxss).toContain('.member-avatar-fallback.team-color-yellow');
  });

  test('onChooseActivityImage chooses an image before opening the cropper', async () => {
    global.wx.chooseMedia = jest.fn(({ success }) => {
      success({
        tempFiles: [
          {
            tempFilePath: 'wxfile://chosen-cover.jpg'
          }
        ]
      });
    });
    global.wx.navigateTo = jest.fn(({ events, success }) => {
      success({
        eventChannel: {
          emit: jest.fn()
        }
      });
      events.coverCropped({
        tempFilePath: 'wxfile://cropped-cover.jpg',
        thumbTempFilePath: 'wxfile://cropped-thumb.jpg',
        shareTempFilePath: 'wxfile://cropped-share.jpg'
      });
    });

    const ctx = {
      data: {
        form: {}
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: pageConfig.syncDerivedState
    };

    await pageConfig.onChooseActivityImage.call(ctx);

    expect(global.wx.chooseMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 1,
        mediaType: ['image']
      })
    );
    expect(global.wx.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/pages/activity-cover-crop/index?imagePath=')
      })
    );
    expect(ctx.data.form).toMatchObject({
      coverImage: 'wxfile://cropped-cover.jpg',
      coverThumbImage: 'wxfile://cropped-thumb.jpg',
      shareImage: 'wxfile://cropped-share.jpg',
      imageList: ['wxfile://cropped-cover.jpg']
    });
  });

  test('onChooseDetailImages appends selected images without opening the cover cropper', async () => {
    global.wx.chooseMedia = jest.fn(({ success }) => {
      success({
        tempFiles: [
          {
            tempFilePath: 'wxfile://detail-3.jpg'
          },
          {
            tempFilePath: 'wxfile://detail-4.jpg'
          }
        ]
      });
    });
    global.wx.navigateTo = jest.fn();

    const ctx = {
      data: {
        form: {
          detailImages: ['wxfile://detail-1.jpg', 'wxfile://detail-2.jpg']
        }
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: pageConfig.syncDerivedState
    };

    await pageConfig.onChooseDetailImages.call(ctx);

    expect(global.wx.chooseMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 3,
        mediaType: ['image']
      })
    );
    expect(global.wx.navigateTo).not.toHaveBeenCalled();
    expect(ctx.data.form.detailImages).toEqual([
      'wxfile://detail-1.jpg',
      'wxfile://detail-2.jpg',
      'wxfile://detail-3.jpg',
      'wxfile://detail-4.jpg'
    ]);
  });

  test('onRemoveDetailImage removes the selected detail image', () => {
    const ctx = {
      data: {
        form: {
          detailImages: [
            'wxfile://detail-1.jpg',
            'wxfile://detail-2.jpg',
            'wxfile://detail-3.jpg'
          ]
        }
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      },
      syncDerivedState: pageConfig.syncDerivedState
    };

    pageConfig.onRemoveDetailImage.call(ctx, {
      currentTarget: {
        dataset: {
          index: 1
        }
      }
    });

    expect(ctx.data.form.detailImages).toEqual([
      'wxfile://detail-1.jpg',
      'wxfile://detail-3.jpg'
    ]);
  });

  test('onTeamsChange increases total signup limit when adding a team', () => {
    const nextTeams = [
      { teamName: 'Team 1', maxMembers: 12 },
      { teamName: 'Team 2', maxMembers: 12 }
    ];
    const syncDerivedState = jest.fn();
    const ctx = {
      data: {
        form: {
          signupLimitTotal: 12,
          teams: [
            { teamName: 'Team 1', maxMembers: 12 }
          ]
        }
      },
      syncDerivedState
    };

    pageConfig.onTeamsChange.call(ctx, {
      detail: {
        teams: nextTeams
      }
    });

    expect(syncDerivedState).toHaveBeenCalledWith({
      signupLimitTotal: 24,
      registrationNoticeThreshold: 20,
      teams: nextTeams
    });
  });

  test('onTeamsChange decreases total signup limit when removing a team', () => {
    const nextTeams = [
      { teamName: 'Team 1', maxMembers: 12 }
    ];
    const syncDerivedState = jest.fn();
    const ctx = {
      data: {
        form: {
          signupLimitTotal: 24,
          teams: [
            { teamName: 'Team 1', maxMembers: 12 },
            { teamName: 'Team 2', maxMembers: 12 }
          ]
        }
      },
      syncDerivedState
    };

    pageConfig.onTeamsChange.call(ctx, {
      detail: {
        teams: nextTeams
      }
    });

    expect(syncDerivedState).toHaveBeenCalledWith({
      signupLimitTotal: 12,
      registrationNoticeThreshold: 10,
      teams: nextTeams
    });
  });

  test('onTeamsChange preserves existing bench capacity when adding a team', () => {
    const nextTeams = [
      { teamName: 'Team 1', maxMembers: 12 },
      { teamName: 'Team 2', maxMembers: 12 }
    ];
    const syncDerivedState = jest.fn();
    const ctx = {
      data: {
        form: {
          signupLimitTotal: 18,
          teams: [
            { teamName: 'Team 1', maxMembers: 12 }
          ]
        }
      },
      syncDerivedState
    };

    pageConfig.onTeamsChange.call(ctx, {
      detail: {
        teams: nextTeams
      }
    });

    expect(syncDerivedState).toHaveBeenCalledWith({
      signupLimitTotal: 30,
      registrationNoticeThreshold: 24,
      teams: nextTeams
    });
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

  test('onLoad in copy mode loads a backend copy draft into the create form', async () => {
    const sourceStartAt = new Date(2026, 3, 26, 20, 0).toISOString();
    const sourceEndAt = new Date(2026, 3, 26, 22, 0).toISOString();
    const sourceSignupDeadlineAt = new Date(2026, 3, 26, 19, 30).toISOString();
    getActivityCopyDraft.mockResolvedValue({
      sourceActivityId: 'activity_123',
      draft: {
        title: 'Original Match',
        addressText: 'Half Stone',
        startAt: '',
        endAt: '',
        signupDeadlineAt: '',
        sourceStartAt,
        sourceEndAt,
        sourceSignupDeadlineAt,
        status: 'draft',
        confirmStatus: 'pending',
        requiresTimeReview: true,
        teams: [
          {
            teamName: 'White',
            maxMembers: 6,
            colorKey: 'white'
          }
        ]
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
      mode: 'copy',
      activityId: 'activity_123'
    });

    expect(getActivityCopyDraft).toHaveBeenCalledWith('activity_123');
    expect(ctx.data.isCopyMode).toBe(true);
    expect(ctx.data.copySourceActivityId).toBe('activity_123');
    expect(ctx.data.isEditMode).toBe(false);
    expect(ctx.data.canCreateActivity).toBe(true);
    expect(ctx.data.canSubmitActivity).toBe(true);
    expect(ctx.data.form).toMatchObject({
      title: 'Original Match',
      activityDate: '',
      startTime: '20:00',
      endTime: '22:00',
      signupDeadlineDate: '',
      signupDeadlineTime: '19:30'
    });
  });

  test('onSubmit requires copied activity time to be reviewed before publishing', async () => {
    const ctx = {
      data: {
        form: {
          title: 'Copied Match',
          activityDate: '',
          startTime: '',
          endTime: '',
          signupDeadlineDate: '',
          signupDeadlineTime: ''
        },
        canSubmitActivity: true,
        isCopyMode: true,
        isEditMode: false,
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
    expect(updateActivity).not.toHaveBeenCalled();
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'Review activity time before publishing',
      icon: 'none'
    });
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

  test('onSubmit blocks removing an existing team that already has joined members', async () => {
    const ctx = {
      data: {
        form: {
          title: 'Updated Thursday Match',
          teams: [
            {
              _id: 'team_red',
              teamName: 'Red',
              maxMembers: 6,
              joinedCount: 0
            }
          ]
        },
        editOriginalTeams: [
          {
            _id: 'team_white',
            teamName: 'White',
            maxMembers: 6,
            joinedCount: 2
          },
          {
            _id: 'team_red',
            teamName: 'Red',
            maxMembers: 6,
            joinedCount: 0
          }
        ],
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

    expect(updateActivity).not.toHaveBeenCalled();
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '不能删除已有报名成员的队伍',
      icon: 'none'
    });
  });

  test('onSubmit blocks lowering an existing team capacity below joined members', async () => {
    const ctx = {
      data: {
        form: {
          title: 'Updated Thursday Match',
          teams: [
            {
              _id: 'team_white',
              teamName: 'White',
              maxMembers: 1,
              joinedCount: 2
            }
          ]
        },
        editOriginalTeams: [
          {
            _id: 'team_white',
            teamName: 'White',
            maxMembers: 6,
            joinedCount: 2
          }
        ],
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

    expect(updateActivity).not.toHaveBeenCalled();
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '队伍人数不能低于已报名人数',
      icon: 'none'
    });
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

  test('notification hint input replaces control characters and caps at 20 characters', () => {
    const ctx = {
      data: {
        form: {
          notificationHint: ''
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
          field: 'notificationHint'
        }
      },
      detail: {
        value: '12345\n67890\t1234567890abc'
      }
    });

    expect(ctx.data.form.notificationHint).toBe('12345 67890 12345678');
  });

  test('onSubmit uploads a selected cover before creating the activity', async () => {
    uploadFile.mockImplementation((filePath, cloudPath) => {
      if (cloudPath.startsWith('activity-share-images/')) {
        return Promise.resolve('cloud://prod-env-123/activity-share-images/cover-share.jpg');
      }

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
          shareImage: 'wxfile://tmp_cover_share.jpg',
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
    expect(uploadFile).toHaveBeenCalledWith(
      'wxfile://tmp_cover_share.jpg',
      expect.stringMatching(/^activity-share-images\/.+\.jpg$/)
    );
    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
        coverThumbImage: 'cloud://prod-env-123/activity-cover-thumbs/cover-thumb.jpg',
        shareImage: 'cloud://prod-env-123/activity-share-images/cover-share.jpg',
        imageList: ['cloud://prod-env-123/activity-covers/cover.jpg']
      })
    );
  });

  test('onSubmit requests manager registration notification consent before creating and records it after creation', async () => {
    requestManagerRegistrationNotificationSubscriptionConsent.mockResolvedValue({
      configured: true,
      templateKey: 'manager_registration_notice',
      templateId: 'tmpl_manager',
      status: 'accepted'
    });
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

    expect(requestManagerRegistrationNotificationSubscriptionConsent).toHaveBeenCalled();
    expect(
      requestManagerRegistrationNotificationSubscriptionConsent.mock.invocationCallOrder[0]
    ).toBeLessThan(createActivity.mock.invocationCallOrder[0]);
    expect(recordActivityNotificationSubscription).toHaveBeenCalledWith('activity_123', {
      configured: true,
      templateKey: 'manager_registration_notice',
      templateId: 'tmpl_manager',
      status: 'accepted'
    });
  });

  test('onSubmit uploads selected detail images before creating the activity', async () => {
    uploadFile.mockImplementation((filePath, cloudPath) => {
      if (cloudPath.startsWith('activity-detail-images/')) {
        return Promise.resolve(`cloud://prod-env-123/${cloudPath}`);
      }

      return Promise.resolve('cloud://prod-env-123/activity-covers/cover.jpg');
    });
    createActivity.mockResolvedValue({ activityId: 'activity_123' });

    const ctx = {
      data: {
        form: {
          title: 'Thursday Match',
          coverImage: 'cloud://prod-env-123/activity-covers/cover.jpg',
          imageList: ['cloud://prod-env-123/activity-covers/cover.jpg'],
          detailImages: [
            'wxfile://detail-1.jpg',
            'wxfile://detail-2.jpg',
            'cloud://prod-env-123/activity-detail-images/existing.jpg'
          ]
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
      'wxfile://detail-1.jpg',
      expect.stringMatching(/^activity-detail-images\/.+\.jpg$/)
    );
    expect(uploadFile).toHaveBeenCalledWith(
      'wxfile://detail-2.jpg',
      expect.stringMatching(/^activity-detail-images\/.+\.jpg$/)
    );
    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        detailImages: [
          expect.stringMatching(/^cloud:\/\/prod-env-123\/activity-detail-images\/.+\.jpg$/),
          expect.stringMatching(/^cloud:\/\/prod-env-123\/activity-detail-images\/.+\.jpg$/),
          'cloud://prod-env-123/activity-detail-images/existing.jpg'
        ]
      })
    );
  });

  test('onSubmit uploads mobile HTTP temp cover paths before creating the activity', async () => {
    uploadFile.mockImplementation((filePath, cloudPath) => {
      if (cloudPath.startsWith('activity-cover-thumbs/')) {
        return Promise.resolve('cloud://prod-env-123/activity-cover-thumbs/mobile-thumb.jpg');
      }

      return Promise.resolve('cloud://prod-env-123/activity-covers/mobile-cover.jpg');
    });
    createActivity.mockResolvedValue({ activityId: 'activity_123' });

    const ctx = {
      data: {
        form: {
          title: 'Thursday Match',
          coverImage: 'http://tmp/mobile-cover.jpg',
          coverThumbImage: 'http://tmp/mobile-cover-thumb.jpg',
          imageList: ['http://tmp/mobile-cover.jpg']
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
      'http://tmp/mobile-cover.jpg',
      expect.stringMatching(/^activity-covers\/.+\.jpg$/)
    );
    expect(uploadFile).toHaveBeenCalledWith(
      'http://tmp/mobile-cover-thumb.jpg',
      expect.stringMatching(/^activity-cover-thumbs\/.+\.jpg$/)
    );
    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: 'cloud://prod-env-123/activity-covers/mobile-cover.jpg',
        coverThumbImage: 'cloud://prod-env-123/activity-cover-thumbs/mobile-thumb.jpg',
        imageList: ['cloud://prod-env-123/activity-covers/mobile-cover.jpg']
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
      title: '\u6d3b\u52a8\u5730\u5740\u4e0d\u80fd\u4e3a\u7a7a',
      icon: 'none'
    });
  });

  test('detail image upload previews render without rounded corners', () => {
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-create/index.wxss'),
      'utf8'
    );
    const previewRule = wxss.match(/\.detail-image-preview\s*{[^}]*}/);

    expect(previewRule).not.toBeNull();
    expect(previewRule[0]).not.toContain('border-radius');
  });

  test('activity description textarea accepts up to 2000 characters', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );
    const textareaRule = Array.from(wxml.matchAll(/<textarea[\s\S]*?\/>/g))
      .map(match => match[0])
      .find(markup => markup.includes('data-field="description"'));

    expect(textareaRule).toBeDefined();
    expect(textareaRule).toContain('maxlength="2000"');
  });

  test('activity description textarea keeps the focused input above the iOS keyboard', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );
    const textareaRule = Array.from(wxml.matchAll(/<textarea[\s\S]*?\/>/g))
      .map(match => match[0])
      .find(markup => markup.includes('data-field="description"'));

    expect(wxml).toContain('id="activity-description-field"');
    expect(textareaRule).toBeDefined();
    expect(textareaRule).toContain('bindfocus="onDescriptionFocus"');
    expect(textareaRule).toContain('adjust-position="{{true}}"');
    expect(textareaRule).toContain('cursor-spacing="220"');
    expect(textareaRule).toContain('show-confirm-bar="{{false}}"');
  });

  test('activity description textarea is tall enough for multi-line notes', () => {
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-create/index.wxss'),
      'utf8'
    );
    const textareaRule = wxss.match(/\.textarea\s*{[^}]*}/);

    expect(textareaRule).not.toBeNull();
    expect(textareaRule[0]).toContain('min-height: 500rpx');
  });

  test('scrolls the activity description field into view when it receives focus', () => {
    jest.useFakeTimers();
    global.wx.pageScrollTo = jest.fn();

    pageConfig.onDescriptionFocus();

    expect(global.wx.pageScrollTo).toHaveBeenCalledWith({
      selector: '#activity-description-field',
      offsetTop: -24,
      duration: 160
    });

    jest.runOnlyPendingTimers();

    expect(global.wx.pageScrollTo).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('cover image upload appears before the activity description field', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/activity-create/index.wxml'),
      'utf8'
    );
    const coverIndex = wxml.indexOf('{{i18n.activityCreate.coverImage}}');
    const descriptionIndex = wxml.indexOf('{{i18n.activityCreate.description}}');

    expect(coverIndex).toBeGreaterThan(-1);
    expect(descriptionIndex).toBeGreaterThan(coverIndex);
  });
});
