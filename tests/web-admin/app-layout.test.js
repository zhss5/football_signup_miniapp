const { createWebAdminApp } = require('../../web-admin/src/app');

function createElement(dataset = {}) {
  return {
    hidden: false,
    innerHTML: '',
    textContent: '',
    value: '',
    dataset,
    style: {},
    disabled: false,
    eventHandlers: {},
    attributes: {},
    addEventListener: jest.fn(function addEventListener(eventName, handler) {
      this.eventHandlers[eventName] = handler;
    }),
    setAttribute: jest.fn(function setAttribute(name, value) {
      this.attributes[name] = value;
    }),
    removeAttribute: jest.fn(function removeAttribute(name) {
      delete this.attributes[name];
    }),
    classList: {
      toggle: jest.fn()
    }
  };
}

function createTarget(element) {
  return {
    closest: jest.fn(selector => {
      if (selector === '[data-nav-target]' && element.dataset.navTarget) {
        return element;
      }

      if (selector === '[data-action]' && element.dataset.action) {
        return element;
      }

      if (selector === '[data-activity-id]' && element.dataset.activityId) {
        return element;
      }

      if (
        selector === '[data-attendance-stats-index]' &&
        Object.prototype.hasOwnProperty.call(element.dataset, 'attendanceStatsIndex')
      ) {
        return element;
      }

      return null;
    })
  };
}

function createAppRoot(elements, groups) {
  let clickHandler = null;
  let contextMenuHandler = null;
  let doubleClickHandler = null;

  return {
    querySelector: jest.fn(selector => elements[selector] || null),
    querySelectorAll: jest.fn(selector => groups[selector] || []),
    addEventListener: jest.fn((eventName, handler) => {
      if (eventName === 'click') {
        clickHandler = handler;
      }

      if (eventName === 'contextmenu') {
        contextMenuHandler = handler;
      }

      if (eventName === 'dblclick') {
        doubleClickHandler = handler;
      }
    }),
    click(element, eventOverrides = {}) {
      if (!clickHandler) {
        throw new Error('click handler was not registered');
      }

      return clickHandler({
        target: createTarget(element),
        ...eventOverrides
      });
    },
    dblclick(element) {
      if (!doubleClickHandler) {
        throw new Error('dblclick handler was not registered');
      }

      return doubleClickHandler({
        target: createTarget(element)
      });
    },
    contextmenu(element, eventOverrides = {}) {
      if (!contextMenuHandler) {
        throw new Error('contextmenu handler was not registered');
      }

      const event = {
        preventDefault: jest.fn(),
        target: createTarget(element),
        clientX: 120,
        clientY: 80,
        ...eventOverrides
      };
      const result = contextMenuHandler(event);
      return {
        event,
        result
      };
    },
    submit(element) {
      const handler = element.eventHandlers && element.eventHandlers.submit;
      if (!handler) {
        throw new Error('submit handler was not registered');
      }

      const event = {
        preventDefault: jest.fn(),
        target: element
      };
      const result = handler(event);
      return {
        event,
        result
      };
    }
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}

function buildHarness(user, apiOverrides = {}, options = {}) {
  const nav = {
    users: createElement({ navTarget: 'users' }),
    activities: createElement({ navTarget: 'activities' }),
    attendanceStats: createElement({ navTarget: 'attendance-stats' }),
    logs: createElement({ navTarget: 'logs' })
  };
  const views = {
    users: createElement({ adminView: 'users' }),
    activities: createElement({ adminView: 'activities' }),
    attendanceStats: createElement({ adminView: 'attendance-stats' }),
    logs: createElement({ adminView: 'logs' })
  };
  const elements = {
    '[data-view="identity"]': createElement(),
    '[data-view="login"]': createElement(),
    '[data-view="forbidden"]': createElement(),
    '[data-view="workspace"]': createElement(),
    '[data-current-user]': createElement(),
    '[data-current-user-summary]': createElement(),
    '[data-current-user-openid]': createElement(),
    '[data-current-view-title]': createElement(),
    '[data-users-status]': createElement(),
    '[data-user-avatar-preview]': createElement(),
    '[data-user-avatar-preview-image]': createElement(),
    '[data-action="search-users"]': createElement({ action: 'search-users' }),
    '[data-action="search-activities"]': createElement({ action: 'search-activities' }),
    '[data-action="load-attendance-stats"]': createElement({
      action: 'load-attendance-stats'
    }),
    '[data-users-search-button]': createElement(),
    '[data-activities-search-button]': createElement(),
    '[data-stats-load-button]': createElement(),
    '[data-stats-export-button]': createElement({
      action: 'export-attendance-stats'
    }),
    '[data-activities-table]': createElement(),
    '[data-activities-count]': createElement(),
    '[data-users-table]': createElement(),
    '[data-users-count]': createElement(),
    '[data-activity-context-menu]': createElement(),
    '[data-attendance-stats-table]': createElement(),
    '[data-attendance-stats-count]': createElement(),
    '[data-attendance-stats-empty]': createElement(),
    '[data-attendance-detail]': createElement(),
    '[data-attendance-detail-title]': createElement(),
    '[data-attendance-detail-table]': createElement(),
    '[data-attendance-detail-count]': createElement(),
    '[data-activity-detail]': createElement(),
    '[data-activity-title]': createElement(),
    '[data-activity-detail-loading]': createElement(),
    '[data-activity-detail-body]': createElement(),
    '[data-activity-summary-editor]': createElement(),
    '[data-activity-summary-display]': createElement(),
    '[data-text-edit-dialog]': createElement(),
    '[data-text-edit-title]': createElement(),
    '[data-text-edit-input]': createElement(),
    '[data-roster-keyword]': createElement(),
    '[data-activity-detail-logs-keyword]': createElement(),
    '[data-export-output]': createElement(),
    '[data-roster-table]': createElement(),
    '[data-roster-count]': createElement(),
    '[data-activity-logs-table]': createElement(),
    '[data-activity-detail-logs-table]': createElement(),
    '[data-activity-detail-logs-count]': createElement(),
    '[data-notification-logs-table]': createElement(),
    '[data-logs-status]': createElement(),
    '[name="statsStartAt"]': createElement(),
    '[name="statsEndAt"]': createElement(),
    '[name="statsActivityType"]': createElement(),
    '[name="activityKeyword"]': createElement(),
    '[name="activityStatus"]': createElement(),
    '[name="activityOrganizerKeyword"]': createElement(),
    '[name="activityOrganizerOpenId"]': createElement(),
    '[name="activityStartAtFrom"]': createElement(),
    '[name="activityStartAtTo"]': createElement(),
    '[data-activity-organizer-options]': createElement()
  };
  const appRoot = createAppRoot(elements, {
    '[data-nav-target]': [
      nav.users,
      nav.activities,
      nav.attendanceStats,
      nav.logs
    ],
    '[data-admin-view]': [
      views.users,
      views.activities,
      views.attendanceStats,
      views.logs
    ]
  });
  const api = {
    setWebAdminSessionToken: jest.fn(),
    getCurrentUser: jest.fn().mockResolvedValue(user),
    listActivities: jest.fn().mockResolvedValue({
      items: []
    }),
    listUsers: jest.fn().mockResolvedValue({
      items: []
    }),
    getActivityDetail: jest.fn().mockResolvedValue({
      activity: {},
      teams: []
    }),
    listActivityLogs: jest.fn().mockResolvedValue({
      items: []
    }),
    confirmActivity: jest.fn().mockResolvedValue({
      confirmed: true
    }),
    updateActivityReview: jest.fn().mockResolvedValue({}),
    getAttendanceStats: jest.fn().mockResolvedValue({
      items: []
    }),
    listNotificationLogs: jest.fn().mockResolvedValue({
      items: []
    }),
    resolveFileUrls: jest.fn().mockResolvedValue({}),
    ...apiOverrides
  };
  const storage = {
    getItem: jest.fn().mockReturnValue('session_1'),
    setItem: jest.fn(),
    removeItem: jest.fn()
  };
  const app = createWebAdminApp({
    appRoot,
    api,
    autoPoll: false,
    runtimeRoot: options.runtimeRoot,
    storage
  });

  return {
    api,
    app,
    appRoot,
    elements,
    nav,
    views
  };
}

test('admin users see all sidebar items and land on activity management', async () => {
  const { api, app, elements, nav, views } = buildHarness({
    _id: 'openid_admin',
    roles: ['user', 'admin']
  });

  await app.start();

  expect(elements['[data-view="login"]'].hidden).toBe(true);
  expect(elements['[data-view="workspace"]'].hidden).toBe(false);
  expect(nav.users.hidden).toBe(false);
  expect(nav.activities.hidden).toBe(false);
  expect(nav.attendanceStats.hidden).toBe(false);
  expect(nav.logs.hidden).toBe(true);
  expect(views.activities.hidden).toBe(false);
  expect(views.users.hidden).toBe(true);
  expect(views.logs.hidden).toBe(true);
  expect(elements['[data-current-view-title]'].textContent).toBe('活动管理');
  expect(nav.activities.setAttribute).toHaveBeenCalledWith('aria-current', 'page');
  expect(api.listActivities).toHaveBeenCalled();
  expect(api.listUsers).toHaveBeenCalled();
});

test('global activity logs render the activity title column', async () => {
  const listActivityLogs = jest.fn().mockResolvedValue({
    items: [
      {
        _id: 'log_1',
        activityId: 'activity_1',
        activityTitle: 'Sunday Match',
        action: 'signup_joined',
        operatorOpenId: 'openid_player',
        targetOpenId: 'openid_player',
        targetName: 'Alex',
        teamName: 'Green',
        createdAt: '2026-06-10T10:00:00.000Z'
      }
    ]
  });
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    { listActivityLogs }
  );

  await app.start();
  await app.loadActivityLogs();

  expect(listActivityLogs).toHaveBeenCalledWith({
    activityId: '',
    limit: 50,
    skip: 0
  });
  const html = elements['[data-activity-logs-table]'].innerHTML;
  expect(html).toContain('Sunday Match');
  expect(html).toContain('title="activity_1"');
  expect(html).toContain('Alex 报名 Green');
});

test('global log buttons show loading feedback while fetching logs', async () => {
  const deferred = createDeferred();
  const listActivityLogs = jest.fn()
    .mockResolvedValueOnce({
      items: []
    })
    .mockReturnValueOnce(deferred.promise);
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    { listActivityLogs }
  );
  const button = createElement({ action: 'load-activity-logs' });
  button.textContent = '加载操作日志';

  await app.start();
  listActivityLogs.mockClear();
  const clickResult = appRoot.click(button);

  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe('加载中...');
  expect(elements['[data-logs-status]'].textContent).toContain('操作日志加载中');

  deferred.resolve({ items: [] });
  await clickResult;

  expect(button.disabled).toBe(false);
  expect(elements['[data-logs-status]'].textContent).toContain('操作日志已加载');
});

test('notification log loading errors are shown in the global logs panel', async () => {
  const listNotificationLogs = jest.fn().mockRejectedValue(new Error('notification logs unavailable'));
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    { listNotificationLogs }
  );
  const button = createElement({ action: 'load-notification-logs' });
  button.textContent = '加载通知日志';

  await app.start();
  await appRoot.click(button);

  expect(elements['[data-logs-status]'].textContent).toContain('notification logs unavailable');
});

test('loadNotificationLogs renders activity and error details', async () => {
  const listNotificationLogs = jest.fn().mockResolvedValue({
    items: [
      {
        _id: 'notice_1',
        activityId: 'activity_1',
        activityTitle: '周五足球',
        notificationType: 'proceeding',
        targetOpenId: 'openid_player',
        status: 'failed',
        errorMessage: 'quota exceeded',
        createdAt: '2026-06-10T10:00:00.000Z'
      }
    ]
  });
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    { listNotificationLogs }
  );

  await app.start();
  await app.loadNotificationLogs();

  const html = elements['[data-notification-logs-table]'].innerHTML;
  expect(html).toContain('周五足球');
  expect(html).toContain('title="activity_1"');
  expect(html).toContain('failed');
  expect(html).toContain('quota exceeded');
});

test('logged-in users see account details in the topbar', async () => {
  const { app, elements } = buildHarness({
    _id: 'openid_admin',
    preferredName: '张虹生',
    roles: ['user', 'admin']
  });

  await app.start();

  expect(elements['[data-current-user-summary]'].textContent).toBe('当前登录：张虹生（普通用户、管理员）');
  expect(elements['[data-current-user-openid]'].textContent).toBe('openid_admin');
});

test('logout clears the stored web admin session and returns to QR login', async () => {
  const createWebAdminLogin = jest.fn().mockResolvedValue({
    loginId: 'login_2',
    pollToken: 'poll_2',
    qrPayload: 'football-signup-web-admin-login:login_2:confirm_2'
  });
  const { api, app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      preferredName: '张虹生',
      roles: ['user', 'admin']
    },
    {
      createWebAdminLogin
    }
  );

  await app.start();
  appRoot.click(createElement({ action: 'logout' }));
  await Promise.resolve();

  expect(api.setWebAdminSessionToken).toHaveBeenCalledWith('');
  expect(elements['[data-view="workspace"]'].hidden).toBe(true);
  expect(elements['[data-view="login"]'].hidden).toBe(false);
  expect(app.state.currentUser).toBe(null);
  expect(createWebAdminLogin).toHaveBeenCalled();
});

test('organizers can use operations views but do not see user management', async () => {
  const { api, app, nav, views } = buildHarness({
    _id: 'openid_organizer',
    roles: ['user', 'organizer']
  });

  await app.start();

  expect(nav.users.hidden).toBe(true);
  expect(nav.activities.hidden).toBe(false);
  expect(nav.attendanceStats.hidden).toBe(false);
  expect(nav.logs.hidden).toBe(true);
  expect(views.activities.hidden).toBe(false);
  expect(views.users.hidden).toBe(true);
  expect(views.logs.hidden).toBe(true);
  expect(api.listActivities).toHaveBeenCalled();
  expect(api.listUsers).not.toHaveBeenCalled();
});

test('regular users stay on the forbidden view', async () => {
  const { app, elements } = buildHarness({
    _id: 'openid_user',
    roles: ['user']
  });

  await app.start();

  expect(elements['[data-view="forbidden"]'].hidden).toBe(false);
  expect(elements['[data-view="workspace"]'].hidden).toBe(true);
});

test('sidebar navigation activates only the selected content view', async () => {
  const { app, appRoot, nav, views } = buildHarness({
    _id: 'openid_admin',
    roles: ['user', 'admin']
  });

  await app.start();
  appRoot.click(nav.attendanceStats);

  expect(views.attendanceStats.hidden).toBe(false);
  expect(views.activities.hidden).toBe(true);
  expect(views.logs.hidden).toBe(true);
  expect(app.state.activeView).toBe('attendance-stats');
  expect(nav.attendanceStats.setAttribute).toHaveBeenCalledWith('aria-current', 'page');
  expect(nav.activities.removeAttribute).toHaveBeenCalledWith('aria-current');
});

test('activity rows render selectable activity metadata without inline actions', async () => {
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listActivities: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'activity_pending',
            title: '待确认活动',
            startAt: '2026-06-19T12:00:00.000Z',
            status: 'published',
            confirmStatus: 'pending',
            organizerOpenId: 'openid_owner',
            organizerName: 'Owner Zhang',
            organizerManagerAlias: 'Coach Zhang',
            joinedCount: 1,
            signupLimitTotal: 12
          },
          {
            _id: 'activity_confirmed',
            title: '已确认活动',
            startAt: '2026-06-20T12:00:00.000Z',
            status: 'published',
            confirmStatus: 'confirmed',
            organizerOpenId: 'openid_fallback',
            joinedCount: 2,
            signupLimitTotal: 20
          }
        ]
      })
    }
  );

  await app.start();

  const html = elements['[data-activities-table]'].innerHTML;
  expect(html).not.toContain('data-action="confirm-activity"');
  expect(html).not.toContain('data-action="load-activity-detail"');
  expect(html).toContain('data-activity-id="activity_pending"');
  expect(html).toContain('data-can-confirm-proceeding="true"');
  expect(html).toContain('data-can-confirm-proceeding="false"');
  expect(html).toContain('2026-06-19 20:00');
  expect(html).not.toContain('2026-06-19T12:00:00.000Z');
  expect(html).toContain('title="openid_owner">Coach Zhang</span>');
  expect(html).toContain('openid_fallback');
  expect(html).toContain('<td>1</td>');
  expect(html).toContain('<td>12</td>');
  expect(html).toContain('<td>2</td>');
  expect(html).toContain('<td>20</td>');
  expect(elements['[data-activities-count]'].textContent).toBe('共 2 行');
  expect(elements['[data-activity-organizer-options]'].innerHTML).toContain('value="Coach Zhang"');
  expect(elements['[data-activity-organizer-options]'].innerHTML).not.toContain('openid_owner');
});

test('activity search uses organizer keyword instead of requiring an openid', async () => {
  const listActivities = jest.fn().mockResolvedValue({ items: [] });
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listActivities
    }
  );

  elements['[name="activityKeyword"]'].value = '  title  ';
  elements['[name="activityStatus"]'].value = 'published';
  elements['[name="activityOrganizerKeyword"]'].value = '  Coach Zhang  ';
  elements['[name="activityStartAtFrom"]'].value = '2026-06-01';
  elements['[name="activityStartAtTo"]'].value = '2026-06-30';

  await app.start();
  listActivities.mockClear();
  const { result } = appRoot.submit(elements['[data-action="search-activities"]']);
  await result;

  expect(listActivities).toHaveBeenCalledWith({
    scope: 'web-admin',
    keyword: 'title',
    status: 'published',
    organizerKeyword: 'Coach Zhang',
    organizerOpenId: '',
    startAtFrom: '2026-06-01',
    startAtTo: '2026-06-30',
    limit: 20,
    skip: 0
  });
});

test('clicking an activity row selects it without opening the detail modal', async () => {
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listActivities: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'activity_pending',
            title: '待确认活动',
            startAt: '2026-06-19T12:00:00.000Z',
            status: 'published',
            confirmStatus: 'pending',
            organizerOpenId: 'openid_owner',
            joinedCount: 1
          }
        ]
      })
    }
  );
  const row = createElement({
    activityId: 'activity_pending'
  });
  elements['[data-activity-detail]'].hidden = true;

  await app.start();
  appRoot.click(row);

  expect(app.state.selectedActivityId).toBe('activity_pending');
  expect(elements['[data-activity-detail]'].hidden).toBe(true);
  expect(elements['[data-activities-table]'].innerHTML).toContain('class="is-selected"');
  expect(elements['[data-activities-table]'].innerHTML).toContain('aria-selected="true"');
});

test('double-clicking an activity row opens the detail modal', async () => {
  const getActivityDetail = jest.fn().mockResolvedValue({
    activity: {
      title: '双击打开活动'
    },
    teams: []
  });
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getActivityDetail,
      listActivities: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'activity_pending',
            title: '待确认活动',
            startAt: '2026-06-19T12:00:00.000Z',
            status: 'published',
            confirmStatus: 'pending',
            organizerOpenId: 'openid_owner',
            joinedCount: 1
          }
        ]
      })
    }
  );
  const row = createElement({
    activityId: 'activity_pending'
  });
  elements['[data-activity-detail]'].hidden = true;

  await app.start();
  await appRoot.dblclick(row);

  expect(getActivityDetail).toHaveBeenCalledWith('activity_pending');
  expect(app.state.selectedActivityId).toBe('activity_pending');
  expect(elements['[data-activity-detail]'].hidden).toBe(false);
  expect(elements['[data-activity-title]'].textContent).toBe('双击打开活动');
  expect(elements['[data-activities-table]'].innerHTML).toContain('class="is-selected"');
});

test('second click from a browser double-click opens detail modal and shows loading state', async () => {
  const detailDeferred = createDeferred();
  const getActivityDetail = jest.fn().mockReturnValue(detailDeferred.promise);
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getActivityDetail,
      listActivities: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'activity_pending',
            title: 'Pending Activity',
            startAt: '2026-06-19T12:00:00.000Z',
            status: 'published',
            confirmStatus: 'pending',
            organizerOpenId: 'openid_owner',
            joinedCount: 1
          }
        ]
      })
    }
  );
  const row = createElement({
    activityId: 'activity_pending'
  });
  elements['[data-activity-detail]'].hidden = true;
  elements['[data-activity-detail-loading]'].hidden = true;
  elements['[data-activity-detail-body]'].hidden = false;

  await app.start();
  const pending = appRoot.click(row, { detail: 2 });

  expect(getActivityDetail).toHaveBeenCalledWith('activity_pending');
  expect(app.state.selectedActivityId).toBe('activity_pending');
  expect(elements['[data-activity-detail]'].hidden).toBe(false);
  expect(elements['[data-activity-detail-loading]'].hidden).toBe(false);
  expect(elements['[data-activity-detail-body]'].hidden).toBe(true);

  await appRoot.dblclick(row);
  expect(getActivityDetail).toHaveBeenCalledTimes(1);

  detailDeferred.resolve({
    activity: {
      title: 'Loaded Activity'
    },
    teams: []
  });
  await pending;

  expect(elements['[data-activity-detail-loading]'].hidden).toBe(true);
  expect(elements['[data-activity-detail-body]'].hidden).toBe(false);
  expect(elements['[data-activity-title]'].textContent).toBe('Loaded Activity');
});

test('right-clicking a pending activity shows open and confirm actions in a context menu', async () => {
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listActivities: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'activity_pending',
            title: '待确认活动',
            startAt: '2026-06-19T12:00:00.000Z',
            status: 'published',
            confirmStatus: 'pending',
            organizerOpenId: 'openid_owner',
            joinedCount: 1
          }
        ]
      })
    }
  );
  const row = createElement({
    activityId: 'activity_pending'
  });

  await app.start();
  const { event } = appRoot.contextmenu(row, {
    clientX: 160,
    clientY: 96
  });

  expect(event.preventDefault).toHaveBeenCalled();
  expect(app.state.selectedActivityId).toBe('activity_pending');
  expect(elements['[data-activity-context-menu]'].hidden).toBe(false);
  expect(elements['[data-activity-context-menu]'].style.left).toBe('160px');
  expect(elements['[data-activity-context-menu]'].style.top).toBe('96px');
  expect(elements['[data-activity-context-menu]'].innerHTML).toContain('data-action="load-activity-detail"');
  expect(elements['[data-activity-context-menu]'].innerHTML).toContain('data-action="confirm-activity"');
  expect(elements['[data-activity-context-menu]'].innerHTML).toContain('确认举行');
});

test('right-clicking a confirmed activity only shows the open action in the context menu', async () => {
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listActivities: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'activity_confirmed',
            title: '已确认活动',
            startAt: '2026-06-20T12:00:00.000Z',
            status: 'published',
            confirmStatus: 'confirmed',
            organizerOpenId: 'openid_owner',
            joinedCount: 2
          }
        ]
      })
    }
  );
  const row = createElement({
    activityId: 'activity_confirmed'
  });

  await app.start();
  appRoot.contextmenu(row);

  expect(elements['[data-activity-context-menu]'].innerHTML).toContain('data-action="load-activity-detail"');
  expect(elements['[data-activity-context-menu]'].innerHTML).not.toContain('data-action="confirm-activity"');
});

test('activity confirm button calls notify wrapper and refreshes activities', async () => {
  const deferred = createDeferred();
  const confirmActivity = jest.fn().mockReturnValue(deferred.promise);
  const listActivities = jest.fn()
    .mockResolvedValueOnce({
      items: [
        {
          _id: 'activity_pending',
          title: '待确认活动',
          startAt: '2026-06-19T12:00:00.000Z',
          status: 'published',
          confirmStatus: 'pending',
          organizerOpenId: 'openid_owner',
          joinedCount: 1
        }
      ]
    })
    .mockResolvedValueOnce({
      items: [
        {
          _id: 'activity_pending',
          title: '待确认活动',
          startAt: '2026-06-19T12:00:00.000Z',
          status: 'published',
          confirmStatus: 'confirmed',
          organizerOpenId: 'openid_owner',
          joinedCount: 1
        }
      ]
    });
  const { app, appRoot } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      confirmActivity,
      listActivities
    }
  );
  const button = createElement({
    action: 'confirm-activity',
    activityId: 'activity_pending'
  });
  button.textContent = '确认举行';

  await app.start();
  const clickResult = appRoot.click(button);

  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe('确认中...');
  expect(confirmActivity).toHaveBeenCalledWith('activity_pending');

  deferred.resolve({
    confirmed: true
  });
  await clickResult;

  expect(button.disabled).toBe(false);
  expect(listActivities).toHaveBeenCalledTimes(2);
});

test('attendance stats submit shows eligible-activity empty state for blank results', async () => {
  const { app, appRoot, api, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getAttendanceStats: jest.fn().mockResolvedValue({
        items: []
      })
    }
  );
  elements['[name="statsStartAt"]'].value = '2026-06-01';
  elements['[name="statsEndAt"]'].value = '2026-06-30';
  elements['[data-attendance-stats-empty]'].hidden = true;

  await app.start();
  const { result } = appRoot.submit(elements['[data-action="load-attendance-stats"]']);
  await result;

  expect(api.getAttendanceStats).toHaveBeenCalledWith({
    startAt: '2026-06-01',
    endAt: '2026-06-30',
    activityType: 'all'
  });
  expect(elements['[data-attendance-stats-table]'].innerHTML).toBe('');
  expect(elements['[data-attendance-stats-empty]'].hidden).toBe(false);
  expect(elements['[data-attendance-stats-empty]'].textContent).toContain('已开始且未取消/未删除');
});

test('attendance stats submit renders rows and hides the empty state', async () => {
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getAttendanceStats: jest.fn().mockResolvedValue({
        items: [
          {
            participantName: '张虹生',
            managerAlias: '酱油仔',
            signupCount: 2,
            presentCount: 1,
            absentCount: 1,
            attendanceRate: 0.5,
            details: [
              {
                activityTitle: '测试0618',
                teamName: '队伍1',
                signupName: '张虹生',
                managerAlias: '酱油仔',
                attendanceStatus: 'absent',
                startAt: '2026-06-19T12:00:00.000Z'
              },
              {
                activityTitle: '测试0621',
                teamName: '队伍1',
                signupName: '张虹生',
                managerAlias: '酱油仔',
                attendanceStatus: 'present',
                startAt: '2026-06-22T00:00:00.000Z'
              }
            ]
          }
        ]
      })
    }
  );
  elements['[data-attendance-stats-empty]'].hidden = false;

  await app.start();
  const { result } = appRoot.submit(elements['[data-action="load-attendance-stats"]']);
  await result;

  expect(elements['[data-attendance-stats-table]'].innerHTML).toContain('张虹生');
  expect(elements['[data-attendance-stats-table]'].innerHTML).toContain('酱油仔');
  expect(elements['[data-attendance-stats-table]'].innerHTML).toContain('50.00%');
  expect(elements['[data-attendance-stats-table]'].innerHTML).toContain(
    'data-attendance-stats-index="0"'
  );
  expect(elements['[data-attendance-stats-count]'].textContent).toBe('共 1 行');
  expect(elements['[data-attendance-stats-empty]'].hidden).toBe(true);
});

test('double-clicking an attendance stats row opens activity-level details', async () => {
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getAttendanceStats: jest.fn().mockResolvedValue({
        items: [
          {
            participantName: '张虹生',
            managerAlias: '酱油20',
            signupCount: 4,
            presentCount: 2,
            absentCount: 2,
            attendanceRate: 0.5,
            details: [
              {
                activityTitle: '测试0618',
                teamName: '队伍1',
                signupName: '张虹生',
                managerAlias: '酱油20',
                attendanceStatus: 'absent',
                startAt: '2026-06-19T12:00:00.000Z'
              },
              {
                activityTitle: '测试0621',
                teamName: '队伍1',
                signupName: '张虹生',
                managerAlias: '酱油20',
                attendanceStatus: 'present',
                startAt: '2026-06-22T00:00:00.000Z'
              }
            ]
          }
        ]
      })
    }
  );
  const row = createElement({ attendanceStatsIndex: '0' });
  elements['[data-attendance-detail]'].hidden = true;

  await app.start();
  const { result } = appRoot.submit(elements['[data-action="load-attendance-stats"]']);
  await result;
  appRoot.dblclick(row);

  expect(elements['[data-attendance-detail]'].hidden).toBe(false);
  expect(elements['[data-attendance-detail-title]'].textContent).toContain('酱油20');
  expect(elements['[data-attendance-detail-table]'].innerHTML).toContain('测试0618');
  expect(elements['[data-attendance-detail-table]'].innerHTML).not.toContain('队伍1');
  expect(elements['[data-attendance-detail-table]'].innerHTML).toContain('缺勤');
  expect(elements['[data-attendance-detail-table]'].innerHTML).toContain('测试0621');
  expect(elements['[data-attendance-detail-table]'].innerHTML).toContain('出勤');
  expect(elements['[data-attendance-detail-count]'].textContent).toBe('共 2 行');

  appRoot.click(createElement({ action: 'close-attendance-detail' }));
  expect(elements['[data-attendance-detail]'].hidden).toBe(true);
});

test('attendance stats exports loaded rows as CSV text', async () => {
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getAttendanceStats: jest.fn().mockResolvedValue({
        items: [
          {
            participantName: '张虹生',
            managerAlias: '酱油2',
            signupCount: 2,
            presentCount: 1,
            absentCount: 1,
            attendanceRate: 0.5
          },
          {
            participantName: '人员1',
            managerAlias: '',
            signupCount: 1,
            presentCount: 1,
            absentCount: 0,
            attendanceRate: 1
          }
        ]
      })
    }
  );

  await app.start();
  const { result } = appRoot.submit(elements['[data-action="load-attendance-stats"]']);
  await result;
  appRoot.click(elements['[data-stats-export-button]']);

  expect(elements['[data-export-output]'].value).toContain('参与者,备注,报名次数,出勤,缺勤,出勤率');
  expect(elements['[data-export-output]'].value).toContain('张虹生,酱油2,2,1,1,50.00%');
  expect(elements['[data-export-output]'].value).toContain('人员1,,1,1,0,100.00%');
});

test('user rows render Chinese role labels without changing role values', async () => {
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listUsers: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'openid_player',
            preferredName: '张三',
            avatarUrl: 'https://example.com/avatar.jpg',
            managerAlias: 'Left foot',
            roles: ['user', 'organizer']
          }
        ]
      })
    }
  );

  await app.start();

  const html = elements['[data-users-table]'].innerHTML;
  expect(html).toContain('普通用户、组织者');
  expect(html).toContain('class="user-display"');
  expect(html).not.toContain('class="user-avatar-button"');
  expect(html).not.toContain('data-action="preview-user-avatar"');
  expect(html).not.toContain('data-avatar-url="https://example.com/avatar.jpg"');
  expect(html).not.toContain('src="https://example.com/avatar.jpg"');
  expect(html).toContain('data-role="organizer"');
  expect(html).toContain('Left foot');
  expect(html).toContain('data-action="edit-user-manager-alias"');
  expect(html).toContain('data-target-openid="openid_player"');
  expect(html).toContain('class="editable-text-control"');
  expect(html).toContain('class="editable-text-action"');
  expect(html).not.toContain('data-user-manager-alias="openid_player"');
  expect(html).not.toContain('data-action="save-user-manager-alias"');
  expect(html).not.toContain('class="manager-alias-control"');
  expect(html).toContain('class="role-management-control"');
  expect(html).toMatch(
    /<td><div class="editable-text-control">[\s\S]*Left foot[\s\S]*data-action="edit-user-manager-alias"[\s\S]*<\/div><\/td>/
  );
  expect(html).toMatch(
    /<td><div class="role-management-control"><div class="role-toggle-list">[\s\S]*data-role="organizer"[\s\S]*data-action="save-roles"[\s\S]*<\/div><\/td>/
  );
  expect(html).not.toContain('class="table-actions"');
  expect(html).toContain('aria-label="保存用户角色"');
  expect(html).not.toContain('aria-label="保存用户备注"');
  expect(html).toContain('组织者');
  expect(html).toContain('保存');
  expect(html).not.toContain('Save');
  expect(elements['[data-users-count]'].textContent).toBe('共 1 行');
});

test('user rows ignore CloudBase avatar file IDs on the user management page', async () => {
  const resolveFileUrls = jest.fn().mockResolvedValue({
    'cloud://test-env/user-avatars/player.jpg': 'https://tmp.example.com/player.jpg'
  });
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listUsers: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'openid_player',
            preferredName: '张三',
            avatarUrl: 'cloud://test-env/user-avatars/player.jpg',
            roles: ['user']
          }
        ]
      }),
      resolveFileUrls
    }
  );

  await app.start();

  expect(resolveFileUrls).not.toHaveBeenCalled();
  const html = elements['[data-users-table]'].innerHTML;
  expect(html).not.toContain('data-avatar-url=');
  expect(html).not.toContain('data-avatar-source-url=');
  expect(html).not.toContain('src="https://tmp.example.com/player.jpg"');
});

test('clicking a roster avatar opens the large avatar preview', async () => {
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getActivityDetail: jest.fn().mockResolvedValue({
        activity: { title: '活动1' },
        teams: [
          {
            _id: 'team_1',
            teamName: '队伍1',
            members: [
              {
                registrationId: 'reg_1',
                userOpenId: 'openid_player',
                signupName: 'Alex',
                avatarUrl: 'https://example.com/avatar-large.jpg',
                preferredPositions: [],
                attendanceStatus: 'present'
              }
            ]
          }
        ]
      })
    }
  );

  elements['[data-user-avatar-preview]'].hidden = true;

  await app.start();
  await app.loadActivityDetail('activity_1');
  expect(elements['[data-roster-table]'].innerHTML).toContain('class="user-avatar-button"');
  expect(elements['[data-roster-table]'].innerHTML).toContain(
    'data-avatar-url="https://example.com/avatar-large.jpg"'
  );
  expect(elements['[data-roster-table]'].innerHTML).toContain(
    "removeAttribute('data-action')"
  );
  appRoot.click(createElement({
    action: 'preview-user-avatar',
    avatarUrl: 'https://example.com/avatar-large.jpg',
    avatarName: 'Alex'
  }));

  expect(elements['[data-user-avatar-preview]'].hidden).toBe(false);
  expect(elements['[data-user-avatar-preview-image]'].attributes.src).toBe(
    'https://example.com/avatar-large.jpg'
  );
  expect(elements['[data-user-avatar-preview-image]'].attributes.alt).toBe('Alex');

  appRoot.click(createElement({ action: 'close-user-avatar-preview' }));

  expect(elements['[data-user-avatar-preview]'].hidden).toBe(true);
});

test('activity detail roster resolves CloudBase avatar file IDs before rendering', async () => {
  const resolveFileUrls = jest.fn().mockResolvedValue({
    'cloud://test-env/activity-avatars/player.jpg': 'https://tmp.example.com/player.jpg'
  });
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      resolveFileUrls,
      getActivityDetail: jest.fn().mockResolvedValue({
        activity: { title: '活动1' },
        teams: [
          {
            _id: 'team_1',
            teamName: '队伍1',
            members: [
              {
                registrationId: 'reg_1',
                userOpenId: 'openid_player',
                signupName: 'Alex',
                avatarUrl: 'cloud://test-env/activity-avatars/player.jpg',
                preferredPositions: [],
                attendanceStatus: 'present'
              }
            ]
          }
        ]
      })
    }
  );

  await app.start();
  await app.loadActivityDetail('activity_1');

  expect(resolveFileUrls).toHaveBeenCalledWith(['cloud://test-env/activity-avatars/player.jpg']);
  const html = elements['[data-roster-table]'].innerHTML;
  expect(html).toContain('data-avatar-url="https://tmp.example.com/player.jpg"');
  expect(html).toContain('data-avatar-source-url="cloud://test-env/activity-avatars/player.jpg"');
  expect(html).toContain('src="https://tmp.example.com/player.jpg"');
});

test('user search button shows spinner feedback while the request is pending', async () => {
  const deferred = createDeferred();
  const listUsers = jest.fn()
    .mockResolvedValueOnce({
      items: []
    })
    .mockReturnValueOnce(deferred.promise);
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listUsers
    }
  );
  const form = elements['[data-action="search-users"]'];
  const button = elements['[data-users-search-button]'];
  button.textContent = '搜索';

  await app.start();
  listUsers.mockClear();
  const submission = appRoot.submit(form);

  expect(submission.event.preventDefault).toHaveBeenCalled();
  expect(listUsers).toHaveBeenCalledTimes(1);
  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe('搜索中...');
  expect(button.attributes['aria-busy']).toBe('true');
  expect(button.classList.toggle).toHaveBeenCalledWith('is-loading', true);

  deferred.resolve({
    items: [],
    hasMore: false
  });
  await submission.result;

  expect(button.disabled).toBe(false);
  expect(button.textContent).toBe('搜索');
  expect(button.attributes['aria-busy']).toBeUndefined();
  expect(button.classList.toggle).toHaveBeenCalledWith('is-loading', false);
});

test('user manager alias can be edited from user management dialog', async () => {
  const updateUserManagerAlias = jest.fn().mockResolvedValue({
    user: {
      _id: 'openid_player',
      managerAlias: 'New alias'
    }
  });
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listUsers: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'openid_player',
            preferredName: '张三',
            managerAlias: 'Old alias',
            roles: ['user']
          }
        ]
      }),
      updateUserManagerAlias
    }
  );
  await app.start();
  appRoot.click(createElement({
    action: 'edit-user-manager-alias',
    targetOpenid: 'openid_player'
  }));
  expect(elements['[data-text-edit-dialog]'].hidden).toBe(false);
  expect(elements['[data-text-edit-title]'].textContent).toBe('编辑备注');
  expect(elements['[data-text-edit-input]'].value).toBe('Old alias');
  elements['[data-text-edit-input]'].value = 'New alias';

  await appRoot.click(createElement({
    action: 'save-text-edit'
  }));

  await Promise.resolve();

  expect(updateUserManagerAlias).toHaveBeenCalledWith('openid_player', 'New alias');
  expect(elements['[data-text-edit-dialog]'].hidden).toBe(true);
});

test('user role save button shows progress and completion feedback', async () => {
  const deferred = createDeferred();
  const updateUserRoles = jest.fn().mockReturnValue(deferred.promise);
  const listUsers = jest.fn()
    .mockResolvedValueOnce({
      items: [
        {
          _id: 'openid_player',
          preferredName: 'Player Zhang',
          managerAlias: '',
          roles: ['user']
        }
      ]
    })
    .mockResolvedValueOnce({
      items: [
        {
          _id: 'openid_player',
          preferredName: 'Player Zhang',
          managerAlias: '',
          roles: ['user', 'organizer']
        }
      ]
    });
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listUsers,
      updateUserRoles
    }
  );
  const button = createElement({
    action: 'save-roles',
    openid: 'openid_player'
  });
  button.textContent = '保存';
  elements['input[data-openid="openid_player"][data-role="organizer"]'] = {
    checked: true
  };

  await app.start();
  const clickResult = appRoot.click(button);

  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe('保存中...');
  expect(updateUserRoles).toHaveBeenCalledWith('openid_player', ['user', 'organizer']);

  deferred.resolve({
    user: {
      _id: 'openid_player',
      roles: ['user', 'organizer']
    }
  });
  await clickResult;

  expect(button.disabled).toBe(false);
  expect(elements['[data-users-status]'].textContent).toContain('角色已保存');
});

test('user manager alias dialog save button shows progress and completion feedback', async () => {
  const deferred = createDeferred();
  const updateUserManagerAlias = jest.fn().mockReturnValue(deferred.promise);
  const listUsers = jest.fn()
    .mockResolvedValueOnce({
      items: [
        {
          _id: 'openid_player',
          preferredName: 'Player Zhang',
          managerAlias: 'Old alias',
          roles: ['user']
        }
      ]
    })
    .mockResolvedValueOnce({
      items: [
        {
          _id: 'openid_player',
          preferredName: 'Player Zhang',
          managerAlias: 'New alias',
          roles: ['user']
        }
      ]
    });
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listUsers,
      updateUserManagerAlias
    }
  );

  await app.start();
  appRoot.click(createElement({
    action: 'edit-user-manager-alias',
    targetOpenid: 'openid_player'
  }));
  elements['[data-text-edit-input]'].value = 'New alias';

  const button = createElement({
    action: 'save-text-edit'
  });
  button.textContent = '保存';
  const clickResult = appRoot.click(button);

  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe('保存中...');
  expect(updateUserManagerAlias).toHaveBeenCalledWith('openid_player', 'New alias');

  deferred.resolve({
    user: {
      _id: 'openid_player',
      managerAlias: 'New alias'
    }
  });
  await clickResult;

  expect(button.disabled).toBe(false);
  expect(elements['[data-users-status]'].textContent).toContain('备注已保存');
});

test('activity detail renders Chinese roster operation labels while keeping enum payloads', async () => {
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getActivityDetail: jest.fn().mockResolvedValue({
        activity: {
          title: '周五足球'
        },
        teams: [
          {
            teamName: '红队',
            members: [
              {
                registrationId: 'reg_1',
                userOpenId: 'openid_player',
                signupName: '张三',
                managerAlias: '老张',
                preferredPositions: ['forward'],
                proxyRegistration: false,
                attendanceStatus: 'present'
              },
              {
                registrationId: 'reg_2',
                userOpenId: 'proxy_1',
                signupName: '代报名',
                proxyRegistration: true,
                attendanceStatus: 'absent'
              }
            ]
          }
        ]
      })
    }
  );

  await app.start();
  await app.loadActivityDetail('activity_1');

  const html = elements['[data-roster-table]'].innerHTML;
  expect(elements['[data-activity-title]'].textContent).toBe('周五足球');
  expect(elements['[data-roster-count]'].textContent).toBe('共 2 行');
  expect(html).toContain('<td>1</td>');
  expect(html).toContain('<td>2</td>');
  expect(html).toContain('出勤');
  expect(html).toContain('缺勤');
  expect(html).toContain('是');
  expect(html).toContain('否');
  expect(html).toContain('data-next-status="absent"');
  expect(html).toContain('标记缺勤');
  expect(html).toContain('编辑');
  expect(html).toContain('class="editable-text-control"');
  expect(html).toContain('class="editable-text-action"');
  expect(html).toContain('class="attendance-status-control"');
  expect(html).toMatch(
    /<td><div class="editable-text-control">[\s\S]*老张[\s\S]*data-action="edit-manager-alias"[\s\S]*<\/div><\/td>/
  );
  expect(html).toMatch(
    /<td><div class="attendance-status-control">[\s\S]*出勤[\s\S]*data-action="toggle-attendance"[\s\S]*标记缺勤[\s\S]*<\/div><\/td>/
  );
  expect(html).not.toContain('class="table-actions"');
  expect(html).not.toContain('Save Alias');
});

test('activity detail loads and renders current activity operation logs', async () => {
  const listActivityLogs = jest.fn().mockResolvedValue({
    items: [
      {
        _id: 'log_1',
        action: 'registration_moved',
        operatorOpenId: 'openid_admin',
        operatorName: 'Admin Zhang',
        operatorManagerAlias: 'Captain',
        targetOpenId: 'openid_player',
        targetName: 'Alex',
        targetManagerAlias: 'Left foot',
        fromTeamName: 'Red',
        toTeamName: 'Green',
        createdAt: '2026-06-10T12:00:00.000Z'
      }
    ]
  });
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getActivityDetail: jest.fn().mockResolvedValue({
        activity: {
          title: 'Friday Football'
        },
        teams: []
      }),
      listActivityLogs
    }
  );

  await app.start();
  await app.loadActivityDetail('activity_1');

  expect(listActivityLogs).toHaveBeenCalledWith({
    activityId: 'activity_1',
    limit: 50,
    skip: 0
  });
  const html = elements['[data-activity-detail-logs-table]'].innerHTML;
  expect(elements['[data-activity-detail-logs-count]'].textContent).toBe('共 1 行');
  expect(html).toContain('<td>1</td>');
  expect(html).toContain('Left foot 从 Red 换到 Green');
  expect(html).toContain('Captain');
  expect(html).toContain('title="openid_admin"');
  expect(html).not.toContain('<code>openid_admin</code>');
  expect(html).toContain('2026-06-10 20:00');
  expect(html).not.toContain('2026-06-10T12:00:00.000Z');
});

test('activity detail attendance and alias actions update the current rows without reloading the detail', async () => {
  const getActivityDetail = jest.fn().mockResolvedValue({
    activity: {
      title: 'Friday Football',
      activitySummary: 'Old summary'
    },
    teams: [
      {
        teamName: 'Red',
        members: [
          {
            registrationId: 'reg_1',
            userOpenId: 'openid_player',
            signupName: 'Alex',
            managerAlias: 'Old alias',
            preferredPositions: ['forward'],
            proxyRegistration: false,
            attendanceStatus: 'present'
          }
        ]
      }
    ]
  });
  const setRegistrationAttendance = jest.fn().mockResolvedValue({
    registration: {
      registrationId: 'reg_1',
      attendanceStatus: 'absent'
    }
  });
  const updateParticipantManagerAlias = jest.fn().mockResolvedValue({
    user: {
      _id: 'openid_player',
      managerAlias: 'New alias'
    }
  });
  const updateActivityReview = jest.fn()
    .mockResolvedValueOnce({
      registration: {
        registrationId: 'reg_1',
        performanceDescription: 'Strong press'
      }
    })
    .mockResolvedValueOnce({
      activity: {
        activitySummary: 'Good match'
      }
    });
  const listActivityLogs = jest.fn()
    .mockResolvedValueOnce({
      items: []
    })
    .mockResolvedValue({
      items: [
        {
          _id: 'log_1',
          action: 'attendance_update',
          operatorOpenId: 'openid_admin',
          targetOpenId: 'openid_player',
          targetName: 'Alex',
          attendanceStatus: 'absent',
          createdAt: '2026-06-10T10:00:00.000Z'
        }
      ]
    });
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getActivityDetail,
      listActivityLogs,
      setRegistrationAttendance,
      updateParticipantManagerAlias,
      updateActivityReview
    }
  );

  await app.start();
  await app.loadActivityDetail('activity_1');
  getActivityDetail.mockClear();

  await appRoot.click(createElement({
    action: 'toggle-attendance',
    registrationId: 'reg_1',
    nextStatus: 'absent'
  }));

  expect(getActivityDetail).not.toHaveBeenCalled();
  expect(elements['[data-roster-table]'].innerHTML).toContain('缺勤');
  expect(elements['[data-roster-table]'].innerHTML).toContain('标记出勤');

  await appRoot.click(createElement({
    action: 'edit-manager-alias',
    targetOpenid: 'openid_player'
  }));
  expect(elements['[data-text-edit-dialog]'].hidden).toBe(false);
  expect(elements['[data-text-edit-title]'].textContent).toBe('编辑备注');
  expect(elements['[data-text-edit-input]'].value).toBe('Old alias');
  elements['[data-text-edit-input]'].value = 'New alias';
  await appRoot.click(createElement({
    action: 'save-text-edit'
  }));

  expect(getActivityDetail).not.toHaveBeenCalled();
  expect(elements['[data-roster-table]'].innerHTML).toContain('New alias');
  expect(elements['[data-activity-detail-logs-table]'].innerHTML).toContain('Alex 标记为缺勤');
  expect(elements['[data-text-edit-dialog]'].hidden).toBe(true);

  await appRoot.click(createElement({
    action: 'edit-performance-description',
    registrationId: 'reg_1'
  }));
  expect(elements['[data-text-edit-dialog]'].hidden).toBe(false);
  expect(elements['[data-text-edit-title]'].textContent).toBe('编辑表现描述');
  elements['[data-text-edit-input]'].value = 'Strong press';
  await appRoot.click(createElement({
    action: 'save-text-edit'
  }));

  expect(updateActivityReview).toHaveBeenCalledWith('activity_1', {
    registrationId: 'reg_1',
    performanceDescription: 'Strong press'
  });
  expect(getActivityDetail).not.toHaveBeenCalled();
  expect(elements['[data-roster-table]'].innerHTML).toContain('Strong press');

  expect(elements['[data-activity-summary-display]'].innerHTML).toBe('Old summary');
  updateActivityReview.mockClear();
  await appRoot.click(createElement({
    action: 'edit-activity-summary'
  }));
  elements['[data-text-edit-input]'].value = 'Discarded summary';
  await appRoot.click(createElement({
    action: 'cancel-text-edit'
  }));
  expect(updateActivityReview).not.toHaveBeenCalled();
  expect(elements['[data-activity-summary-display]'].innerHTML).toBe('Old summary');
  expect(elements['[data-text-edit-dialog]'].hidden).toBe(true);

  await appRoot.click(createElement({
    action: 'edit-activity-summary'
  }));
  expect(elements['[data-text-edit-dialog]'].hidden).toBe(false);
  expect(elements['[data-text-edit-title]'].textContent).toBe('编辑活动总结');
  expect(elements['[data-text-edit-input]'].value).toBe('Old summary');
  elements['[data-text-edit-input]'].value = 'Good match';
  await appRoot.click(createElement({
    action: 'save-text-edit'
  }));

  expect(updateActivityReview).toHaveBeenCalledWith('activity_1', {
    activitySummary: 'Good match'
  });
  expect(getActivityDetail).not.toHaveBeenCalled();
  expect(elements['[data-activity-summary-display]'].innerHTML).toBe('Good match');
  expect(elements['[data-text-edit-dialog]'].hidden).toBe(true);
});

test('activity detail exports filtered roster and activity logs as CSV text', async () => {
  const { app, appRoot, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getActivityDetail: jest.fn().mockResolvedValue({
        activity: {
          title: 'Friday Football'
        },
        teams: [
          {
            _id: 'team_red',
            teamName: 'Red',
            members: [
              {
                registrationId: 'reg_1',
                userOpenId: 'openid_alex',
                signupName: 'Alex',
                managerAlias: 'Left foot',
                preferredPositions: ['forward'],
                proxyRegistration: false,
                attendanceStatus: 'present'
              },
              {
                registrationId: 'reg_2',
                userOpenId: 'openid_ben',
                signupName: 'Ben',
                managerAlias: 'Goalkeeper',
                preferredPositions: ['goalkeeper'],
                proxyRegistration: false,
                attendanceStatus: 'absent'
              }
            ]
          }
        ]
      }),
      listActivityLogs: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'log_1',
            action: 'signup_joined',
            operatorOpenId: 'openid_alex',
            operatorName: 'Alex',
            operatorManagerAlias: 'Left foot',
            targetOpenId: 'openid_alex',
            targetName: 'Alex',
            targetManagerAlias: 'Left foot',
            teamName: 'Red',
            createdAt: '2026-06-10T10:00:00.000Z'
          },
          {
            _id: 'log_2',
            action: 'signup_cancelled',
            operatorOpenId: 'openid_ben',
            operatorName: 'Ben',
            operatorManagerAlias: 'Goalkeeper',
            targetOpenId: 'openid_ben',
            targetName: 'Ben',
            targetManagerAlias: 'Goalkeeper',
            createdAt: '2026-06-10T11:00:00.000Z'
          }
        ]
      })
    }
  );

  await app.start();
  await app.loadActivityDetail('activity_1');

  elements['[data-roster-keyword]'].value = 'Goalkeeper';
  elements['[data-roster-keyword]'].eventHandlers.input();
  appRoot.click(createElement({ action: 'export-activity-roster-view' }));

  expect(elements['[data-export-output]'].value).toContain('队伍,报名名称,备注,表现描述,位置偏好,代报名,出勤状态');
  expect(elements['[data-export-output]'].value).not.toContain('Alex');
  expect(elements['[data-export-output]'].value).toContain('Ben');

  elements['[data-activity-detail-logs-keyword]'].value = 'openid_ben';
  elements['[data-activity-detail-logs-keyword]'].eventHandlers.input();
  appRoot.click(createElement({ action: 'export-activity-logs-view' }));

  expect(elements['[data-export-output]'].value).toContain('操作,操作人,时间');
  expect(elements['[data-export-output]'].value).not.toContain('操作,操作人,报名人,时间');
  expect(elements['[data-export-output]'].value).not.toContain('Alex 报名');
  expect(elements['[data-export-output]'].value).toContain('Goalkeeper 取消报名');
  expect(elements['[data-export-output]'].value).toContain('Goalkeeper');
});

test('activity detail close action hides the modal', async () => {
  const { app, appRoot, elements } = buildHarness({
    _id: 'openid_admin',
    roles: ['user', 'admin']
  });
  const closeButton = createElement({ action: 'close-activity-detail' });

  await app.start();
  await app.loadActivityDetail('activity_1');
  expect(elements['[data-activity-detail]'].hidden).toBe(false);

  appRoot.click(closeButton);

  expect(elements['[data-activity-detail]'].hidden).toBe(true);
});

test('activity detail filters roster rows by keyword inside the modal', async () => {
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      getActivityDetail: jest.fn().mockResolvedValue({
        activity: {
          title: 'Friday Football'
        },
        teams: [
          {
            _id: 'team_red',
            teamName: 'Red',
            members: [
              {
                registrationId: 'reg_1',
                userOpenId: 'openid_alex',
                signupName: 'Alex',
                managerAlias: 'Left foot',
                preferredPositions: ['forward'],
                proxyRegistration: false,
                attendanceStatus: 'present'
              },
              {
                registrationId: 'reg_2',
                userOpenId: 'openid_ben',
                signupName: 'Ben',
                managerAlias: 'Goalkeeper',
                preferredPositions: ['goalkeeper'],
                proxyRegistration: false,
                attendanceStatus: 'absent'
              }
            ]
          }
        ]
      })
    }
  );

  await app.start();
  await app.loadActivityDetail('activity_1');
  expect(elements['[data-roster-table]'].innerHTML).toContain('Alex');
  expect(elements['[data-roster-table]'].innerHTML).toContain('Ben');

  elements['[data-roster-keyword]'].value = 'Goalkeeper';
  elements['[data-roster-keyword]'].eventHandlers.input();

  const html = elements['[data-roster-table]'].innerHTML;
  expect(html).not.toContain('Alex');
  expect(html).toContain('Ben');
});

test('activity detail filters activity log rows by keyword inside the modal', async () => {
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    {
      listActivityLogs: jest.fn().mockResolvedValue({
        items: [
          {
            _id: 'log_1',
            action: 'signup_joined',
            operatorOpenId: 'openid_alex',
            targetOpenId: 'openid_alex',
            targetName: 'Alex',
            teamName: 'Red',
            createdAt: '2026-06-10T10:00:00.000Z'
          },
          {
            _id: 'log_2',
            action: 'signup_cancelled',
            operatorOpenId: 'openid_ben',
            targetOpenId: 'openid_ben',
            targetName: 'Ben',
            createdAt: '2026-06-10T11:00:00.000Z'
          }
        ]
      })
    }
  );

  await app.start();
  await app.loadActivityDetail('activity_1');
  expect(elements['[data-activity-detail-logs-table]'].innerHTML).toContain('Alex');
  expect(elements['[data-activity-detail-logs-table]'].innerHTML).toContain('Ben');

  elements['[data-activity-detail-logs-keyword]'].value = 'openid_ben';
  elements['[data-activity-detail-logs-keyword]'].eventHandlers.input();

  const html = elements['[data-activity-detail-logs-table]'].innerHTML;
  expect(html).not.toContain('Alex');
  expect(html).toContain('Ben');
});

test('activity detail loads all activity operation log pages', async () => {
  const listActivityLogs = jest.fn()
    .mockResolvedValueOnce({
      hasMore: true,
      items: [
        {
          _id: 'log_1',
          action: 'signup_joined',
          operatorOpenId: 'openid_player',
          targetOpenId: 'openid_player',
          targetName: 'Alex',
          teamName: 'Red',
          createdAt: '2026-06-10T10:00:00.000Z'
        }
      ]
    })
    .mockResolvedValueOnce({
      hasMore: false,
      items: [
        {
          _id: 'log_2',
          action: 'signup_cancelled',
          operatorOpenId: 'openid_player',
          targetOpenId: 'openid_player',
          targetName: 'Alex',
          createdAt: '2026-06-10T11:00:00.000Z'
        }
      ]
    });
  const { app, elements } = buildHarness(
    {
      _id: 'openid_admin',
      roles: ['user', 'admin']
    },
    { listActivityLogs }
  );

  await app.start();
  await app.loadActivityDetail('activity_1');

  expect(listActivityLogs).toHaveBeenNthCalledWith(1, {
    activityId: 'activity_1',
    limit: 50,
    skip: 0
  });
  expect(listActivityLogs).toHaveBeenNthCalledWith(2, {
    activityId: 'activity_1',
    limit: 50,
    skip: 50
  });
  const html = elements['[data-activity-detail-logs-table]'].innerHTML;
  expect(html).toContain('Alex 报名 Red');
  expect(html).toContain('Alex 取消报名');
});
