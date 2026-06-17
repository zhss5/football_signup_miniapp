const { createWebAdminApp } = require('../../web-admin/src/app');

function createElement(dataset = {}) {
  return {
    hidden: false,
    innerHTML: '',
    textContent: '',
    value: '',
    dataset,
    disabled: false,
    attributes: {},
    addEventListener: jest.fn(),
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

      return null;
    })
  };
}

function createAppRoot(elements, groups) {
  let clickHandler = null;

  return {
    querySelector: jest.fn(selector => elements[selector] || null),
    querySelectorAll: jest.fn(selector => groups[selector] || []),
    addEventListener: jest.fn((eventName, handler) => {
      if (eventName === 'click') {
        clickHandler = handler;
      }
    }),
    click(element) {
      if (!clickHandler) {
        throw new Error('click handler was not registered');
      }

      clickHandler({
        target: createTarget(element)
      });
    }
  };
}

function buildHarness(user, apiOverrides = {}) {
  const nav = {
    users: createElement({ navTarget: 'users' }),
    activities: createElement({ navTarget: 'activities' }),
    attendanceStats: createElement({ navTarget: 'attendance-stats' }),
    exports: createElement({ navTarget: 'exports' }),
    logs: createElement({ navTarget: 'logs' })
  };
  const views = {
    users: createElement({ adminView: 'users' }),
    activities: createElement({ adminView: 'activities' }),
    attendanceStats: createElement({ adminView: 'attendance-stats' }),
    exports: createElement({ adminView: 'exports' }),
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
    '[data-activities-table]': createElement(),
    '[data-users-table]': createElement(),
    '[data-activity-detail]': createElement(),
    '[data-activity-title]': createElement(),
    '[data-roster-table]': createElement(),
    '[data-export-output]': createElement()
  };
  const appRoot = createAppRoot(elements, {
    '[data-nav-target]': [
      nav.users,
      nav.activities,
      nav.attendanceStats,
      nav.exports,
      nav.logs
    ],
    '[data-admin-view]': [
      views.users,
      views.activities,
      views.attendanceStats,
      views.exports,
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
  expect(nav.exports.hidden).toBe(false);
  expect(nav.logs.hidden).toBe(false);
  expect(views.activities.hidden).toBe(false);
  expect(views.users.hidden).toBe(true);
  expect(elements['[data-current-view-title]'].textContent).toBe('活动管理');
  expect(nav.activities.setAttribute).toHaveBeenCalledWith('aria-current', 'page');
  expect(api.listActivities).toHaveBeenCalled();
  expect(api.listUsers).toHaveBeenCalled();
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
  expect(nav.exports.hidden).toBe(false);
  expect(nav.logs.hidden).toBe(false);
  expect(views.activities.hidden).toBe(false);
  expect(views.users.hidden).toBe(true);
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
  expect(views.exports.hidden).toBe(true);
  expect(views.logs.hidden).toBe(true);
  expect(app.state.activeView).toBe('attendance-stats');
  expect(nav.attendanceStats.setAttribute).toHaveBeenCalledWith('aria-current', 'page');
  expect(nav.activities.removeAttribute).toHaveBeenCalledWith('aria-current');
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
  expect(html).toContain('data-role="organizer"');
  expect(html).toContain('data-user-manager-alias="openid_player"');
  expect(html).toContain('value="Left foot"');
  expect(html).toContain('data-action="save-user-manager-alias"');
  expect(html).toContain('组织者');
  expect(html).toContain('保存');
  expect(html).not.toContain('Save');
});

test('user manager alias can be saved from user management', async () => {
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
  elements['[data-user-manager-alias="openid_player"]'] = {
    value: 'New alias'
  };

  await app.start();
  appRoot.click(createElement({
    action: 'save-user-manager-alias',
    targetOpenid: 'openid_player'
  }));

  await Promise.resolve();

  expect(updateUserManagerAlias).toHaveBeenCalledWith('openid_player', 'New alias');
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
  expect(html).toContain('出勤');
  expect(html).toContain('缺勤');
  expect(html).toContain('是');
  expect(html).toContain('否');
  expect(html).toContain('data-next-status="absent"');
  expect(html).toContain('标记缺勤');
  expect(html).toContain('保存识别名');
  expect(html).not.toContain('Save Alias');
});
