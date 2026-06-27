const fs = require('fs');
const path = require('path');

jest.mock('../../../miniprogram/services/user-service', () => ({
  ensureUserProfile: jest.fn()
}));

jest.mock('../../../miniprogram/services/activity-service', () => ({
  cancelActivity: jest.fn(),
  deleteActivity: jest.fn(),
  listActivities: jest.fn(),
  resolveActivityCoverImages: jest.fn(items => Promise.resolve(items))
}));

jest.mock('../../../miniprogram/services/notification-service', () => ({
  notifyActivityParticipants: jest.fn()
}));

jest.mock('../../../miniprogram/services/web-admin-service', () => ({
  confirmWebAdminLogin: jest.fn()
}));

jest.mock('../../../miniprogram/utils/formatters', () => ({
  buildActivityCardVm: jest.fn(item => ({
    ...item,
    id: item._id,
    title: item.title,
    startAt: item.startAt,
    endAt: item.endAt,
    status: item.status
  }))
}));

jest.mock('../../../miniprogram/utils/i18n', () => ({
  buildLanguageOptions: jest.fn(() => []),
  getAppLocale: jest.fn(() => 'en-US'),
  getMessages: jest.fn(() => ({
    my: {
      filterLabel: 'Filter',
      languageLabel: 'Language',
      tabs: {
        created: 'Created',
        joined: 'Joined'
      },
      filters: {
        all: 'All',
        published: 'Active',
        cancelled: 'Cancelled',
        deleted: 'Deleted'
      },
      copyUserIdSuccess: 'User ID copied',
      webAdminLoginTitle: 'Web Admin',
      webAdminLoginHint: 'Scan a web admin login code.',
      webAdminLoginAction: 'Scan login code',
      webAdminLoginConfirmTitle: 'Confirm web admin login',
      webAdminLoginConfirmContent: 'Allow this browser to sign in as you?'
    },
    toast: {
      activityConfirmed: 'Activity confirmed',
      webAdminLoginConfirmed: 'Web admin login confirmed',
      webAdminLoginScanUnavailable: 'Scan is unavailable',
      webAdminLoginInvalidQr: 'Invalid login code'
    },
    modal: {
      confirmProceeding: {
        title: 'Confirm Activity',
        content: 'Mark this activity as confirmed?'
      }
    }
  })),
  makeTranslator: jest.fn(() => key => key),
  setPageNavigationTitle: jest.fn(),
  translateErrorMessage: jest.fn(error => error.message)
}));

describe('my page profile marker', () => {
  let pageConfig;
  let ensureUserProfile;
  let listActivities;
  let notifyActivityParticipants;
  let resolveActivityCoverImages;
  let confirmWebAdminLogin;

  beforeEach(() => {
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx = {
      setClipboardData: jest.fn(),
      showToast: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/pages/my/index');
    ({ ensureUserProfile } = require('../../../miniprogram/services/user-service'));
    ({ listActivities, resolveActivityCoverImages } = require('../../../miniprogram/services/activity-service'));
    ({ notifyActivityParticipants } = require('../../../miniprogram/services/notification-service'));
    ({ confirmWebAdminLogin } = require('../../../miniprogram/services/web-admin-service'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('created activity list does not expose confirm or cancel activity actions', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/pages/my/index.wxml'),
      'utf8'
    );

    expect(wxml).not.toContain('catchtap="onConfirmActivityProceeding"');
    expect(wxml).not.toContain('catchtap="onCancelActivity"');
    expect(wxml).not.toContain('{{i18n.activity.actions.confirmProceeding}}');
    expect(wxml).not.toContain('{{i18n.activity.actions.cancelActivity}}');
    expect(wxml).toContain('bind:tapcard="goDetail"');
  });

  test('onShow exposes a copyable user id and readable role summary', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user', 'organizer']
      }
    });
    listActivities.mockResolvedValue({
      items: []
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

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.userOpenId).toBe('openid_owner');
    expect(ctx.data.userRoleText).toBe('user, organizer');
    expect(ctx.data.canConfirmWebAdminLogin).toBe(true);
  });

  test('regular users cannot confirm web admin login from the my page', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_player',
        roles: ['user']
      }
    });
    listActivities.mockResolvedValue({
      items: []
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

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.canConfirmWebAdminLogin).toBe(false);
  });

  test('confirms web admin login from a scanned QR payload', async () => {
    confirmWebAdminLogin.mockResolvedValue({
      ok: true
    });
    global.wx.scanCode = jest.fn(({ success }) =>
      success({
        result: 'football-signup-web-admin-login:login_1:confirm_1'
      })
    );
    global.wx.showModal = jest.fn(({ success }) => success({ confirm: true }));

    const ctx = {
      ...pageConfig,
      data: {
        locale: 'en-US',
        i18n: {
          my: {
            webAdminLoginConfirmTitle: 'Confirm web admin login',
            webAdminLoginConfirmContent: 'Allow this browser to sign in as you?'
          },
          toast: {
            webAdminLoginConfirmed: 'Web admin login confirmed',
            webAdminLoginScanUnavailable: 'Scan is unavailable',
            webAdminLoginInvalidQr: 'Invalid login code'
          }
        }
      }
    };

    await pageConfig.onConfirmWebAdminLogin.call(ctx);

    expect(global.wx.scanCode).toHaveBeenCalledWith({
      onlyFromCamera: false,
      success: expect.any(Function),
      fail: expect.any(Function)
    });
    expect(global.wx.showModal).toHaveBeenCalledWith({
      title: 'my.webAdminLoginConfirmTitle',
      content: 'my.webAdminLoginConfirmContent',
      success: expect.any(Function)
    });
    expect(confirmWebAdminLogin).toHaveBeenCalledWith(
      'football-signup-web-admin-login:login_1:confirm_1'
    );
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: 'toast.webAdminLoginConfirmed',
      icon: 'success'
    });
  });

  test('onCopyUserId copies the current user id', () => {
    const ctx = {
      data: {
        i18n: {
          my: {
            copyUserIdSuccess: 'User ID copied'
          }
        },
        userOpenId: 'openid_owner'
      }
    };

    pageConfig.onCopyUserId.call(ctx);

    expect(global.wx.setClipboardData).toHaveBeenCalledWith({
      data: 'openid_owner',
      success: expect.any(Function)
    });
  });

  test('sorts created and joined activities by newest start time first', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user']
      }
    });
    listActivities.mockImplementation(({ scope }) => {
      if (scope === 'created') {
        return Promise.resolve({
          items: [
            {
              _id: 'created_old',
              title: 'Created Old',
              startAt: '2026-05-01T12:00:00.000Z',
              status: 'published'
            },
            {
              _id: 'created_new',
              title: 'Created New',
              startAt: '2026-05-03T12:00:00.000Z',
              status: 'published'
            }
          ]
        });
      }

      return Promise.resolve({
        items: [
          {
            _id: 'joined_old',
            title: 'Joined Old',
            startAt: '2026-05-02T12:00:00.000Z',
            status: 'published'
          },
          {
            _id: 'joined_new',
            title: 'Joined New',
            startAt: '2026-05-04T12:00:00.000Z',
            status: 'published'
          }
        ]
      });
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

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.createdItems.map(item => item.id)).toEqual(['created_new', 'created_old']);
    expect(ctx.data.joinedItems.map(item => item.id)).toEqual(['joined_new', 'joined_old']);
  });

  test('renders my activity lists before cover url resolution finishes', async () => {
    let resolveCovers;
    const coverResolution = new Promise(resolve => {
      resolveCovers = resolve;
    });

    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user']
      }
    });
    listActivities.mockImplementation(({ scope }) => {
      if (scope === 'created') {
        return Promise.resolve({
          items: [
            {
              _id: 'created_1',
              title: 'Created 1',
              startAt: '2026-05-03T12:00:00.000Z',
              status: 'published',
              coverThumbImage: 'cloud://cover-thumb-created'
            }
          ]
        });
      }

      return Promise.resolve({
        items: [
          {
            _id: 'joined_1',
            title: 'Joined 1',
            startAt: '2026-05-04T12:00:00.000Z',
            status: 'published',
            coverThumbImage: 'cloud://cover-thumb-joined'
          }
        ]
      });
    });
    resolveActivityCoverImages.mockImplementation(items =>
      coverResolution.then(() =>
        items.map(item => ({
          ...item,
          coverDisplayImage: `https://tmp.example.com/${item._id}.jpg`
        }))
      )
    );

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

    const showPromise = pageConfig.onShow.call(ctx);
    await Promise.resolve();
    await Promise.resolve();

    expect(ctx.data.createdItems.map(item => item.id)).toEqual(['created_1']);
    expect(ctx.data.joinedItems.map(item => item.id)).toEqual(['joined_1']);
    expect(ctx.data.createdItems[0].coverDisplayImage).toBeUndefined();
    expect(ctx.data.joinedItems[0].coverDisplayImage).toBeUndefined();
    expect(resolveActivityCoverImages).toHaveBeenCalledWith(
      expect.any(Array),
      { includeShareImage: false }
    );

    resolveCovers();
    await showPromise;
    await Promise.resolve();
    await Promise.resolve();

    expect(ctx.data.createdItems[0].coverDisplayImage).toBe(
      'https://tmp.example.com/created_1.jpg'
    );
    expect(ctx.data.joinedItems[0].coverDisplayImage).toBe(
      'https://tmp.example.com/joined_1.jpg'
    );
  });

  test('renders each activity list as soon as that list request resolves', async () => {
    let resolveJoined;
    const joinedListRequest = new Promise(resolve => {
      resolveJoined = resolve;
    });

    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user']
      }
    });
    listActivities.mockImplementation(({ scope }) => {
      if (scope === 'created') {
        return Promise.resolve({
          items: [
            {
              _id: 'created_fast',
              title: 'Created Fast',
              startAt: '2026-05-03T12:00:00.000Z',
              status: 'published'
            }
          ]
        });
      }

      return joinedListRequest;
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

    const showPromise = pageConfig.onShow.call(ctx);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(ctx.data.createdItems.map(item => item.id)).toEqual(['created_fast']);
    expect(ctx.data.joinedItems).toEqual([]);

    resolveJoined({
      items: [
        {
          _id: 'joined_slow',
          title: 'Joined Slow',
          startAt: '2026-05-04T12:00:00.000Z',
          status: 'published'
        }
      ]
    });
    await showPromise;

    expect(ctx.data.joinedItems.map(item => item.id)).toEqual(['joined_slow']);
  });

  test('excludes expired published activities from the active created filter', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-05-03T12:00:00.000Z'));
    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user']
      }
    });
    listActivities.mockImplementation(({ scope }) => {
      if (scope === 'created') {
        return Promise.resolve({
          items: [
            {
              _id: 'expired_published',
              title: 'Expired Published',
              startAt: '2026-05-01T12:00:00.000Z',
              endAt: '2026-05-01T14:00:00.000Z',
              status: 'published'
            },
            {
              _id: 'future_published',
              title: 'Future Published',
              startAt: '2026-05-04T12:00:00.000Z',
              endAt: '2026-05-04T14:00:00.000Z',
              status: 'published'
            },
            {
              _id: 'cancelled',
              title: 'Cancelled',
              startAt: '2026-05-05T12:00:00.000Z',
              endAt: '2026-05-05T14:00:00.000Z',
              status: 'cancelled'
            }
          ]
        });
      }

      return Promise.resolve({ items: [] });
    });

    const ctx = {
      ...pageConfig,
      data: {
        ...pageConfig.data,
        createdFilter: 'published'
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.createdItems.map(item => item.id)).toEqual(['future_published']);
  });

  test('loads more created activities from the next offset without replacing the first page', async () => {
    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user', 'organizer']
      }
    });
    listActivities.mockImplementation(({ scope, skip }) => {
      if (scope === 'joined') {
        return Promise.resolve({ items: [], hasMore: false });
      }

      if (skip === 20) {
        return Promise.resolve({
          items: [
            {
              _id: 'created_second_page',
              title: 'Created Second Page',
              startAt: '2026-05-01T12:00:00.000Z',
              status: 'published'
            }
          ],
          hasMore: false
        });
      }

      return Promise.resolve({
        items: [
          {
            _id: 'created_first_page',
            title: 'Created First Page',
            startAt: '2026-05-03T12:00:00.000Z',
            status: 'published'
          }
        ],
        hasMore: true
      });
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

    await pageConfig.onShow.call(ctx);
    await pageConfig.onReachBottom.call(ctx);

    expect(listActivities).toHaveBeenCalledWith({ scope: 'created', limit: 20, skip: 0 });
    expect(listActivities).toHaveBeenCalledWith({ scope: 'created', limit: 20, skip: 20 });
    expect(ctx.data.createdItems.map(item => item.id)).toEqual([
      'created_first_page',
      'created_second_page'
    ]);
    expect(ctx.data.createdHasMore).toBe(false);
    expect(ctx.data.createdLoadingMore).toBe(false);
  });

  test('does not mark overdue unresolved created activities or expose list actions', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-05-03T12:00:00.000Z'));
    ensureUserProfile.mockResolvedValue({
      user: {
        _id: 'openid_owner',
        roles: ['user', 'organizer']
      }
    });
    notifyActivityParticipants.mockResolvedValue({
      confirmed: true
    });
    global.wx.showModal = jest.fn(({ success }) => success({ confirm: true }));
    listActivities.mockImplementation(({ scope }) => {
      if (scope === 'created') {
        return Promise.resolve({
          items: [
            {
              _id: 'expired_pending',
              title: 'Expired Pending',
              startAt: '2026-05-01T12:00:00.000Z',
              endAt: '2026-05-01T14:00:00.000Z',
              status: 'published',
              confirmStatus: 'pending'
            },
            {
              _id: 'expired_confirmed',
              title: 'Expired Confirmed',
              startAt: '2026-05-02T12:00:00.000Z',
              endAt: '2026-05-02T14:00:00.000Z',
              status: 'published',
              confirmStatus: 'confirmed'
            }
          ],
          hasMore: false
        });
      }

      return Promise.resolve({ items: [], hasMore: false });
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

    await pageConfig.onShow.call(ctx);

    expect(ctx.data.createdItems.find(item => item.id === 'expired_pending')).not.toHaveProperty(
      'overdueUnresolved'
    );
    expect(ctx.data.createdItems.find(item => item.id === 'expired_confirmed')).not.toHaveProperty(
      'overdueUnresolved'
    );

    expect(notifyActivityParticipants).not.toHaveBeenCalled();
  });
});
