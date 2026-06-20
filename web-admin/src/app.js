(function initApp(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./api'),
      require('./roles'),
      require('./user-management'),
      require('./activity-management')
    );
    return;
  }

  root.WebAdminApp = factory(
    root.WebAdminApi,
    root.WebAdminRoles,
    root.WebAdminUserManagement,
    root.WebAdminActivityManagement
  );
})(typeof globalThis !== 'undefined' ? globalThis : this, function appFactory(apiModule, roles, users, activityUi) {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setHidden(element, hidden) {
    if (element) {
      element.hidden = hidden;
    }
  }

  function escapeSelectorValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  const WEB_ADMIN_SESSION_STORAGE_KEY = 'football-signup-web-admin-session';
  const DEFAULT_ADMIN_VIEW = 'activities';
  const ACTIVITY_LOG_PAGE_LIMIT = 50;
  const ADMIN_VIEW_TITLES = {
    users: '用户管理',
    activities: '活动管理',
    'attendance-stats': '出勤统计',
    exports: '名单导出',
    logs: '日志'
  };
  const ROLE_LABELS = {
    user: '普通用户',
    organizer: '组织者',
    admin: '管理员',
    super_admin: '超级管理员'
  };
  const STATUS_LABELS = {
    absent: '缺勤',
    cancelled: '已取消',
    confirmed: '已确认',
    draft: '草稿',
    pending: '待处理',
    present: '出勤',
    published: '已发布'
  };
  const POSITION_LABELS = {
    defender: '后卫',
    forward: '前锋',
    goalkeeper: '门将',
    midfielder: '中场'
  };

  function getAllowedAdminViews(user) {
    const operationalViews = ['activities', 'attendance-stats', 'exports', 'logs'];

    return roles.isAdmin(user)
      ? ['users', ...operationalViews]
      : operationalViews;
  }

  function formatRoleLabel(role) {
    return ROLE_LABELS[role] || role;
  }

  function formatRoleList(rolesText) {
    return String(rolesText || '')
      .split(',')
      .map(role => formatRoleLabel(role.trim()))
      .filter(Boolean)
      .join('、');
  }

  function formatDelimitedLabels(value, labels) {
    return String(value || '')
      .split('/')
      .map(item => {
        const key = item.trim();
        return labels[key] || key;
      })
      .filter(Boolean)
      .join(' / ');
  }

  function formatStatusText(value) {
    return formatDelimitedLabels(value, STATUS_LABELS);
  }

  function formatAttendanceAction(status) {
    if (status === 'absent') {
      return '标记缺勤';
    }

    if (status === 'present') {
      return '标记出勤';
    }

    return status || '';
  }

  function normalizeKeyword(value) {
    return String(value || '').trim().toLowerCase();
  }

  function fieldsMatchKeyword(fields, keyword) {
    if (!keyword) {
      return true;
    }

    return fields.some(field => String(field || '').toLowerCase().includes(keyword));
  }

  function createWebAdminApp(options = {}) {
    const runtimeRoot = options.root || (typeof document !== 'undefined' ? document : null);
    const appRoot = options.appRoot ||
      (runtimeRoot && runtimeRoot.getElementById
        ? runtimeRoot.getElementById('admin-app')
        : null);
    const runtimeBrowserRoot = options.runtimeRoot ||
      (typeof globalThis !== 'undefined' ? globalThis : {});
    const storage = options.storage ||
      (runtimeBrowserRoot && runtimeBrowserRoot.sessionStorage
        ? runtimeBrowserRoot.sessionStorage
        : null);
    const timerApi = options.timerApi || runtimeBrowserRoot || {};
    const sessionStorageKey = options.sessionStorageKey || WEB_ADMIN_SESSION_STORAGE_KEY;
    const pollIntervalMs = Number(options.pollIntervalMs || 2000);
    let loginPollTimer = null;

    function readStoredWebAdminSessionToken() {
      if (!storage || typeof storage.getItem !== 'function') {
        return '';
      }

      try {
        return String(storage.getItem(sessionStorageKey) || '');
      } catch (error) {
        return '';
      }
    }

    function writeStoredWebAdminSessionToken(token) {
      if (!storage || typeof storage.setItem !== 'function') {
        return;
      }

      try {
        storage.setItem(sessionStorageKey, token);
      } catch (error) {
        // Ignore storage failures. The token still lives in the in-memory API client.
      }
    }

    function removeStoredWebAdminSessionToken() {
      if (!storage || typeof storage.removeItem !== 'function') {
        return;
      }

      try {
        storage.removeItem(sessionStorageKey);
      } catch (error) {
        // Ignore storage failures. The next login still replaces the in-memory token.
      }
    }

    const api = options.api ||
      apiModule.createApiClient(apiModule.createDefaultCallFunction(options.runtimeRoot), {
        webAdminSessionToken: readStoredWebAdminSessionToken()
      });
    const state = {
      currentUser: null,
      loginChallenge: null,
      webAdminSessionToken: readStoredWebAdminSessionToken(),
      rows: [],
      hasMore: false,
      search: users.buildSearchParams({}),
      activities: [],
      activitySearch: activityUi.buildActivitySearchParams({}),
      selectedActivityId: '',
      rosterRows: [],
      statsRows: [],
      activityLogRows: [],
      activityDetailLogRows: [],
      activityDetailRosterKeyword: '',
      activityDetailLogKeyword: '',
      notificationLogRows: [],
      exportCsv: '',
      activeView: DEFAULT_ADMIN_VIEW
    };

    function query(selector) {
      return appRoot ? appRoot.querySelector(selector) : null;
    }

    function queryAll(selector) {
      if (!appRoot || typeof appRoot.querySelectorAll !== 'function') {
        return [];
      }

      return Array.prototype.slice.call(appRoot.querySelectorAll(selector) || []);
    }

    function setLoadingButton(button, loading, loadingText) {
      if (!button) {
        return;
      }

      if (loading) {
        if (!button.dataset.originalText) {
          button.dataset.originalText = button.textContent || '';
        }

        button.disabled = true;
        button.textContent = loadingText || '加载中...';

        if (button.classList && typeof button.classList.toggle === 'function') {
          button.classList.toggle('is-loading', true);
        }

        if (typeof button.setAttribute === 'function') {
          button.setAttribute('aria-busy', 'true');
        }

        return;
      }

      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent || '';
      delete button.dataset.originalText;

      if (button.classList && typeof button.classList.toggle === 'function') {
        button.classList.toggle('is-loading', false);
      }

      if (typeof button.removeAttribute === 'function') {
        button.removeAttribute('aria-busy');
      }
    }

    async function runWithLoadingButton(selector, loadingText, task) {
      const button = query(selector);
      setLoadingButton(button, true, loadingText);

      try {
        return await task();
      } finally {
        setLoadingButton(button, false);
      }
    }

    async function runWithButtonElement(button, loadingText, task) {
      setLoadingButton(button, true, loadingText);

      try {
        return await task();
      } finally {
        setLoadingButton(button, false);
      }
    }

    function renderIdentity(message) {
      const identity = query('[data-view="identity"]');
      if (identity) {
        identity.textContent = message;
      }
    }

    function renderLoginStatus(message) {
      const status = query('[data-login-status]');
      if (status) {
        status.textContent = message;
      }
    }

    function renderUsersStatus(message) {
      const status = query('[data-users-status]');
      if (status) {
        status.textContent = message || '';
      }
    }

    function renderLoginQrPayload(payload) {
      const output = query('[data-login-payload]');
      if (output) {
        output.value = payload || '';
        output.textContent = payload || '';
      }

      const canvas = query('[data-login-qr]');
      const qr = runtimeBrowserRoot && runtimeBrowserRoot.QRCode;
      if (!canvas || !qr || typeof qr.toCanvas !== 'function' || !payload) {
        return;
      }

      try {
        qr.toCanvas(canvas, payload, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M'
        });
      } catch (error) {
        renderLoginStatus('无法生成二维码。请复制下方登录内容后重试。');
      }
    }

    function clearLoginPollTimer() {
      if (
        loginPollTimer &&
        timerApi &&
        typeof timerApi.clearInterval === 'function'
      ) {
        timerApi.clearInterval(loginPollTimer);
      }

      loginPollTimer = null;
    }

    function startLoginPolling() {
      if (
        options.autoPoll === false ||
        !timerApi ||
        typeof timerApi.setInterval !== 'function'
      ) {
        return;
      }

      clearLoginPollTimer();
      loginPollTimer = timerApi.setInterval(() => {
        pollWebAdminLogin().catch(error => renderLoginStatus(getErrorMessage(error)));
      }, pollIntervalMs);
    }

    function renderLoginChallenge(challenge) {
      setHidden(query('[data-view="identity"]'), true);
      setHidden(query('[data-view="login"]'), false);
      setHidden(query('[data-view="forbidden"]'), true);
      setHidden(query('[data-view="workspace"]'), true);
      renderLoginStatus('打开小程序，从“我的”页面扫描此二维码。');
      renderLoginQrPayload(challenge && challenge.qrPayload ? challenge.qrPayload : '');
    }

    function setCurrentViewTitle(viewId) {
      const title = query('[data-current-view-title]');
      if (title) {
        title.textContent = ADMIN_VIEW_TITLES[viewId] || '';
      }
    }

    function renderAdminNavigation(user) {
      const allowedViews = getAllowedAdminViews(user);
      if (!allowedViews.includes(state.activeView)) {
        state.activeView = DEFAULT_ADMIN_VIEW;
      }

      queryAll('[data-nav-target]').forEach(button => {
        const viewId = button && button.dataset ? button.dataset.navTarget : '';
        const allowed = allowedViews.includes(viewId);
        const active = allowed && viewId === state.activeView;

        setHidden(button, !allowed);
        button.disabled = !allowed;

        if (button.classList && typeof button.classList.toggle === 'function') {
          button.classList.toggle('is-active', active);
        }

        if (active && typeof button.setAttribute === 'function') {
          button.setAttribute('aria-current', 'page');
        } else if (typeof button.removeAttribute === 'function') {
          button.removeAttribute('aria-current');
        }
      });

      queryAll('[data-admin-view]').forEach(view => {
        const viewId = view && view.dataset ? view.dataset.adminView : '';
        setHidden(view, !(allowedViews.includes(viewId) && viewId === state.activeView));
      });

      setCurrentViewTitle(state.activeView);
    }

    function setActiveAdminView(viewId) {
      const allowedViews = getAllowedAdminViews(state.currentUser);
      if (!allowedViews.includes(viewId)) {
        return;
      }

      state.activeView = viewId;
      renderAdminNavigation(state.currentUser);
    }

    function getCurrentUserDisplayName(user) {
      return (
        String(user.preferredName || '').trim() ||
        String(user.displayName || '').trim() ||
        String(user.nickName || user.nickname || '').trim() ||
        String(user._id || '').trim()
      );
    }

    function formatCurrentUserSummary(user, userRoles) {
      const name = getCurrentUserDisplayName(user);
      const roleText = userRoles.map(formatRoleLabel).join('、');
      return `当前登录：${name}${roleText ? `（${roleText}）` : ''}`;
    }

    function renderCurrentUserAccount(user, userRoles) {
      const summary = query('[data-current-user-summary]');
      if (summary) {
        summary.textContent = formatCurrentUserSummary(user, userRoles);
      }

      const openid = query('[data-current-user-openid]');
      if (openid) {
        openid.textContent = user._id || '';
      }
    }

    function renderAccess(user) {
      const access = roles.buildAccessState(user);
      setHidden(query('[data-view="identity"]'), true);
      setHidden(query('[data-view="login"]'), true);
      setHidden(query('[data-view="forbidden"]'), access.allowed);
      setHidden(query('[data-view="workspace"]'), !access.allowed);

      if (!access.allowed) {
        return false;
      }

      const label = query('[data-current-user]');
      if (label) {
        label.textContent = formatCurrentUserSummary(user, access.roles);
      }

      renderCurrentUserAccount(user, access.roles);
      renderAdminNavigation(user);

      return true;
    }

    function getSearchFormValues() {
      const keyword = query('[name="keyword"]');
      const role = query('[data-role-filter]');

      return users.buildSearchParams({
        keyword: keyword ? keyword.value : '',
        role: role ? role.value : '',
        limit: 20,
        skip: 0
      });
    }

    function renderRows() {
      const table = query('[data-users-table]');
      if (!table) {
        return;
      }

      table.innerHTML = state.rows
        .map(row => {
          const controls = row.roleControls
            .map(control => {
              const label = formatRoleLabel(control.role);
              const title = control.disabled
                ? `当前账号不能修改${label}角色`
                : `切换${label}角色`;

              return (
                `<label class="role-toggle" title="${escapeHtml(title)}">` +
                `<input type="checkbox" data-role="${control.role}" ` +
                `data-openid="${escapeHtml(row.openid)}" ` +
                `aria-label="${escapeHtml(title)}" ` +
                `${control.checked ? 'checked ' : ''}` +
                `${control.disabled ? 'disabled ' : ''}/>` +
                `<span>${escapeHtml(label)}</span>` +
                `</label>`
              );
            })
            .join('');

          return (
            `<tr data-openid="${escapeHtml(row.openid)}">` +
            `<td>${escapeHtml(row.displayName)}</td>` +
            `<td><code>${escapeHtml(row.openid)}</code></td>` +
            `<td><input type="text" data-user-manager-alias="${escapeHtml(row.openid)}" ` +
            `value="${escapeHtml(row.managerAlias)}" maxlength="128" /></td>` +
            `<td>${escapeHtml(formatRoleList(row.rolesText))}</td>` +
            `<td><div class="role-toggle-list">${controls}</div></td>` +
            `<td><div class="table-actions">` +
            `<button type="button" data-action="save-roles" ` +
            `data-openid="${escapeHtml(row.openid)}" aria-label="保存用户角色">保存</button>` +
            `<button type="button" data-action="save-user-manager-alias" ` +
            `data-target-openid="${escapeHtml(row.openid)}" aria-label="保存用户备注">保存备注</button>` +
            `</div></td>` +
            `</tr>`
          );
        })
        .join('');
    }

    async function searchUsers() {
      state.search = getSearchFormValues();
      const result = await api.listUsers(state.search);
      state.rows = users.buildUserRows(result.items || [], state.currentUser);
      state.hasMore = Boolean(result.hasMore);
      renderRows();
    }

    function getActivityFormValues() {
      const keyword = query('[name="activityKeyword"]');
      const status = query('[name="activityStatus"]');
      const organizerOpenId = query('[name="activityOrganizerOpenId"]');
      const startAtFrom = query('[name="activityStartAtFrom"]');
      const startAtTo = query('[name="activityStartAtTo"]');

      return activityUi.buildActivitySearchParams({
        keyword: keyword ? keyword.value : '',
        status: status ? status.value : '',
        organizerOpenId: organizerOpenId ? organizerOpenId.value : '',
        startAtFrom: startAtFrom ? startAtFrom.value : '',
        startAtTo: startAtTo ? startAtTo.value : '',
        limit: 20,
        skip: 0
      });
    }

    function renderActivityRows() {
      const table = query('[data-activities-table]');
      if (!table) {
        return;
      }

      table.innerHTML = state.activities
        .map(row => {
          const selected = row.activityId && row.activityId === state.selectedActivityId;
          const selectedAttributes = selected
            ? ` class="is-selected" aria-selected="true"`
            : ` aria-selected="false"`;

          return (
            `<tr data-activity-id="${escapeHtml(row.activityId)}" ` +
            `data-can-confirm-proceeding="${row.canConfirmProceeding ? 'true' : 'false'}"` +
            selectedAttributes +
            `>` +
            `<td>${escapeHtml(row.title)}</td>` +
            `<td>${escapeHtml(row.startAt)}</td>` +
            `<td>${escapeHtml(formatStatusText(row.statusText))}</td>` +
            `<td><code>${escapeHtml(row.organizerOpenId)}</code></td>` +
            `<td>${escapeHtml(row.joinedCount)}</td>` +
            `</tr>`
          );
        })
        .join('');
    }

    function getActivityRowById(activityId) {
      return (state.activities || []).find(row => row.activityId === activityId) || null;
    }

    function hideActivityContextMenu() {
      const menu = query('[data-activity-context-menu]');
      if (!menu) {
        return;
      }

      setHidden(menu, true);
    }

    function selectActivity(activityId) {
      if (!getActivityRowById(activityId)) {
        return;
      }

      state.selectedActivityId = activityId;
      renderActivityRows();
    }

    function showActivityContextMenu(activityId, x, y) {
      const row = getActivityRowById(activityId);
      const menu = query('[data-activity-context-menu]');
      if (!row || !menu) {
        return;
      }

      selectActivity(activityId);

      const confirmButton = row.canConfirmProceeding
        ? `<button type="button" role="menuitem" data-action="confirm-activity" ` +
          `data-activity-id="${escapeHtml(row.activityId)}" ` +
          `data-confirm-action="true">确认举行</button>`
        : '';

      menu.innerHTML =
        `<button type="button" role="menuitem" data-action="load-activity-detail" ` +
        `data-activity-id="${escapeHtml(row.activityId)}">打开</button>` +
        confirmButton;
      menu.style.left = `${Math.max(0, Number(x) || 0)}px`;
      menu.style.top = `${Math.max(0, Number(y) || 0)}px`;
      setHidden(menu, false);
    }

    function getFilteredRosterRows() {
      const keyword = normalizeKeyword(state.activityDetailRosterKeyword);
      const rows = activityUi.buildAttendanceRows(state.rosterRows);

      if (!keyword) {
        return rows;
      }

      return rows.filter(row =>
        fieldsMatchKeyword([
          row.teamName,
          row.signupName,
          row.managerAlias,
          row.preferredPositions,
          formatDelimitedLabels(row.preferredPositions, POSITION_LABELS),
          row.userOpenId,
          row.registrationId,
          row.proxyRegistration ? '是' : '否',
          row.attendanceStatus,
          formatStatusText(row.attendanceStatus)
        ], keyword)
      );
    }

    function renderRosterRows() {
      const table = query('[data-roster-table]');
      if (!table) {
        return;
      }

      table.innerHTML = getFilteredRosterRows()
        .map(row => (
          `<tr data-registration-id="${escapeHtml(row.registrationId)}">` +
          `<td>${escapeHtml(row.teamName)}</td>` +
          `<td>${escapeHtml(row.signupName)}</td>` +
          `<td>` +
          `<input type="text" data-manager-alias="${escapeHtml(row.userOpenId)}" ` +
          `value="${escapeHtml(row.managerAlias)}" ${row.proxyRegistration ? 'disabled ' : ''}/>` +
          `</td>` +
          `<td>${escapeHtml(formatDelimitedLabels(row.preferredPositions, POSITION_LABELS))}</td>` +
          `<td>${row.proxyRegistration ? '是' : '否'}</td>` +
          `<td>${escapeHtml(formatStatusText(row.attendanceStatus))}</td>` +
          `<td><div class="table-actions">` +
          `<button type="button" data-action="toggle-attendance" ` +
          `data-registration-id="${escapeHtml(row.registrationId)}" ` +
          `data-next-status="${escapeHtml(row.nextAttendanceStatus)}">` +
          `${escapeHtml(formatAttendanceAction(row.nextAttendanceStatus))}` +
          `</button>` +
          `<button type="button" data-action="save-manager-alias" ` +
          `data-target-openid="${escapeHtml(row.userOpenId)}" ` +
          `${row.proxyRegistration ? 'disabled ' : ''}>保存备注</button>` +
          `</div></td>` +
          `</tr>`
        ))
        .join('');
    }

    function renderStatsRows() {
      const table = query('[data-attendance-stats-table]');
      const empty = query('[data-attendance-stats-empty]');
      const hasRows = state.statsRows.length > 0;

      if (empty) {
        empty.textContent = hasRows ? '' : '仅统计已确认举行活动；当前范围内没有出勤记录。';
        setHidden(empty, hasRows);
      }

      if (!table) {
        return;
      }

      table.innerHTML = state.statsRows
        .map(row => (
          `<tr>` +
          `<td>${escapeHtml(row.participantName)}</td>` +
          `<td>${escapeHtml(row.managerAlias)}</td>` +
          `<td>${escapeHtml(row.signupCount)}</td>` +
          `<td>${escapeHtml(row.presentCount)}</td>` +
          `<td>${escapeHtml(row.absentCount)}</td>` +
          `<td>${escapeHtml(row.attendanceRateText)}</td>` +
          `</tr>`
        ))
        .join('');
    }

    function renderActivityLogRows() {
      const table = query('[data-activity-logs-table]');
      if (!table) {
        return;
      }

      table.innerHTML = state.activityLogRows
        .map(row => (
          `<tr>` +
          `<td>${escapeHtml(row.summary || row.type)}</td>` +
          `<td><code>${escapeHtml(row.operatorOpenId)}</code></td>` +
          `<td>${escapeHtml(row.targetName || row.targetOpenId)}</td>` +
          `<td>${escapeHtml(row.createdAt)}</td>` +
          `</tr>`
        ))
        .join('');
    }

    function getFilteredActivityDetailLogRows() {
      const keyword = normalizeKeyword(state.activityDetailLogKeyword);

      if (!keyword) {
        return state.activityDetailLogRows;
      }

      return state.activityDetailLogRows.filter(row =>
        fieldsMatchKeyword([
          row.id,
          row.summary,
          row.type,
          row.operatorOpenId,
          row.targetOpenId,
          row.targetName,
          row.status,
          row.createdAt
        ], keyword)
      );
    }

    function renderActivityDetailLogRows() {
      const table = query('[data-activity-detail-logs-table]');
      if (!table) {
        return;
      }

      table.innerHTML = getFilteredActivityDetailLogRows()
        .map(row => (
          `<tr>` +
          `<td>${escapeHtml(row.summary || row.type)}</td>` +
          `<td><code>${escapeHtml(row.operatorOpenId)}</code></td>` +
          `<td>${escapeHtml(row.targetName || row.targetOpenId)}</td>` +
          `<td>${escapeHtml(row.createdAt)}</td>` +
          `</tr>`
        ))
        .join('');
    }

    function renderNotificationLogRows() {
      const table = query('[data-notification-logs-table]');
      if (!table) {
        return;
      }

      table.innerHTML = state.notificationLogRows
        .map(row => (
          `<tr>` +
          `<td>${escapeHtml(row.type)}</td>` +
          `<td><code>${escapeHtml(row.targetOpenId)}</code></td>` +
          `<td>${escapeHtml(row.status)}</td>` +
          `<td>${escapeHtml(row.createdAt)}</td>` +
          `</tr>`
        ))
        .join('');
    }

    function getSelectedActivityId() {
      return state.selectedActivityId || '';
    }

    async function loadAllActivityLogRows(activityId) {
      const items = [];
      let skip = 0;

      for (;;) {
        const result = await api.listActivityLogs({
          activityId,
          limit: ACTIVITY_LOG_PAGE_LIMIT,
          skip
        });
        const pageItems = result.items || [];
        items.push(...pageItems);

        if (!result.hasMore || pageItems.length === 0) {
          break;
        }

        skip += ACTIVITY_LOG_PAGE_LIMIT;
      }

      return activityUi.buildActivityLogRows(items);
    }

    function resetActivityDetailFilters() {
      state.activityDetailRosterKeyword = '';
      state.activityDetailLogKeyword = '';

      const rosterKeyword = query('[data-roster-keyword]');
      if (rosterKeyword) {
        rosterKeyword.value = '';
      }

      const detailLogsKeyword = query('[data-activity-detail-logs-keyword]');
      if (detailLogsKeyword) {
        detailLogsKeyword.value = '';
      }
    }

    function closeActivityDetail() {
      setHidden(query('[data-activity-detail]'), true);
    }

    async function searchActivities() {
      state.activitySearch = getActivityFormValues();
      const result = await api.listActivities(state.activitySearch);
      state.activities = activityUi.buildActivityRows(result.items || []);
      if (state.selectedActivityId && !getActivityRowById(state.selectedActivityId)) {
        state.selectedActivityId = '';
      }
      hideActivityContextMenu();
      renderActivityRows();
    }

    async function loadActivityDetail(activityId) {
      const [detail, activityDetailLogRows] = await Promise.all([
        api.getActivityDetail(activityId),
        loadAllActivityLogRows(activityId)
      ]);
      state.selectedActivityId = activityId;
      state.rosterRows = activityUi.buildRosterRows(detail);
      state.activityDetailLogRows = activityDetailLogRows;
      state.exportCsv = '';
      resetActivityDetailFilters();
      renderActivityRows();

      const detailPanel = query('[data-activity-detail]');
      setHidden(detailPanel, false);

      const title = query('[data-activity-title]');
      if (title) {
        title.textContent = detail.activity && detail.activity.title ? detail.activity.title : activityId;
      }

      const output = query('[data-export-output]');
      if (output) {
        output.value = '';
      }

      renderRosterRows();
      renderActivityDetailLogRows();
    }

    async function confirmActivity(activityId) {
      if (!activityId) {
        return;
      }

      await api.confirmActivity(activityId);
      await searchActivities();

      if (getSelectedActivityId() === activityId) {
        await loadActivityDetail(activityId);
      }
    }

    async function toggleAttendance(registrationId, nextStatus) {
      const activityId = getSelectedActivityId();
      if (!activityId || !registrationId || !nextStatus) {
        return;
      }

      await api.setRegistrationAttendance(activityId, registrationId, nextStatus);
      await loadActivityDetail(activityId);
    }

    async function saveManagerAlias(targetOpenId) {
      const activityId = getSelectedActivityId();
      const input = query(`[data-manager-alias="${escapeSelectorValue(targetOpenId)}"]`);
      if (!activityId || !targetOpenId || !input) {
        return;
      }

      await api.updateParticipantManagerAlias(activityId, targetOpenId, input.value || '');
      await loadActivityDetail(activityId);
    }

    async function saveUserManagerAlias(targetOpenId) {
      const input = query(`[data-user-manager-alias="${escapeSelectorValue(targetOpenId)}"]`);
      if (!targetOpenId || !input) {
        return;
      }

      await api.updateUserManagerAlias(targetOpenId, input.value || '');
      await searchUsers();
    }

    async function loadAttendanceStats() {
      const startAt = query('[name="statsStartAt"]');
      const endAt = query('[name="statsEndAt"]');
      const result = await api.getAttendanceStats({
        startAt: startAt ? startAt.value : '',
        endAt: endAt ? endAt.value : ''
      });
      state.statsRows = activityUi.buildStatsRows(result.items || result.rows || []);
      renderStatsRows();
    }

    async function exportRoster() {
      const activityId = getSelectedActivityId();
      if (!activityId) {
        return;
      }

      const result = await api.exportActivityRoster(activityId);
      state.exportCsv = activityUi.rowsToCsv(result.rows || []);

      const output = query('[data-export-output]');
      if (output) {
        output.value = state.exportCsv;
      }
    }

    async function loadActivityLogs() {
      const result = await api.listActivityLogs({
        activityId: getSelectedActivityId(),
        limit: ACTIVITY_LOG_PAGE_LIMIT,
        skip: 0
      });
      state.activityLogRows = activityUi.buildActivityLogRows(result.items || []);
      renderActivityLogRows();
    }

    async function loadNotificationLogs() {
      const result = await api.listNotificationLogs({
        activityId: getSelectedActivityId(),
        limit: 50,
        skip: 0
      });
      state.notificationLogRows = activityUi.buildNotificationLogRows(result.items || []);
      renderNotificationLogRows();
    }

    async function beginWebAdminLogin() {
      clearLoginPollTimer();
      renderIdentity('正在准备后台登录...');
      const challenge = await api.createWebAdminLogin();
      state.loginChallenge = challenge;
      renderLoginChallenge(challenge);
      startLoginPolling();
      return challenge;
    }

    async function logoutWebAdmin() {
      clearLoginPollTimer();
      removeStoredWebAdminSessionToken();
      state.currentUser = null;
      state.webAdminSessionToken = '';
      state.loginChallenge = null;
      state.rows = [];
      state.activities = [];
      state.rosterRows = [];
      state.statsRows = [];
      state.activityLogRows = [];
      state.activityDetailLogRows = [];
      state.activityDetailRosterKeyword = '';
      state.activityDetailLogKeyword = '';
      state.notificationLogRows = [];
      state.exportCsv = '';
      hideActivityContextMenu();

      if (api && typeof api.setWebAdminSessionToken === 'function') {
        api.setWebAdminSessionToken('');
      }

      return beginWebAdminLogin();
    }

    async function loadWorkspace() {
      renderIdentity('正在检查身份...');
      state.currentUser = await api.getCurrentUser();

      if (!renderAccess(state.currentUser)) {
        return state;
      }

      await searchActivities();

      if (roles.isAdmin(state.currentUser)) {
        await searchUsers();
      }

      return state;
    }

    async function pollWebAdminLogin() {
      const challenge = state.loginChallenge || {};
      if (!challenge.loginId || !challenge.pollToken) {
        return null;
      }

      const result = await api.pollWebAdminLogin(challenge.loginId, challenge.pollToken);

      if (!result || result.status === 'pending') {
        renderLoginStatus('等待小程序确认登录...');
        return result;
      }

      if (result.status === 'expired') {
        clearLoginPollTimer();
        renderLoginStatus('登录二维码已过期，请点击重试重新生成。');
        return result;
      }

      if (result.status === 'confirmed' && result.webAdminSessionToken) {
        clearLoginPollTimer();
        state.webAdminSessionToken = result.webAdminSessionToken;
        state.loginChallenge = null;
        if (api && typeof api.setWebAdminSessionToken === 'function') {
          api.setWebAdminSessionToken(result.webAdminSessionToken);
        }
        writeStoredWebAdminSessionToken(result.webAdminSessionToken);
        return loadWorkspace();
      }

      return result;
    }

    async function saveRoles(openid) {
      const row = (state.rows || []).find(item => item.openid === openid);
      if (!row) {
        return;
      }

      const targetUser = {
        _id: row.openid,
        roles: row.rolesText.split(',').map(item => item.trim()).filter(Boolean)
      };
      const changes = {};

      row.roleControls.forEach(control => {
        const input = query(
          `input[data-openid="${escapeSelectorValue(openid)}"][data-role="${control.role}"]`
        );
        if (input && input.checked !== control.checked) {
          changes[control.role] = input.checked;
        }
      });

      const payload = users.buildRoleUpdatePayload(state.currentUser, targetUser, changes);
      await api.updateUserRoles(payload.targetOpenId, payload.roles);
      await searchUsers();
    }

    function bindEvents() {
      const form = query('[data-action="search-users"]');
      if (form) {
        form.addEventListener('submit', event => {
          event.preventDefault();
          return runWithLoadingButton('[data-users-search-button]', '搜索中...', searchUsers)
            .catch(error => renderIdentity(error.message));
        });
      }

      const activitiesForm = query('[data-action="search-activities"]');
      if (activitiesForm) {
        activitiesForm.addEventListener('submit', event => {
          event.preventDefault();
          return runWithLoadingButton(
            '[data-activities-search-button]',
            '搜索中...',
            searchActivities
          ).catch(error => renderIdentity(error.message));
        });
      }

      const statsForm = query('[data-action="load-attendance-stats"]');
      if (statsForm) {
        statsForm.addEventListener('submit', event => {
          event.preventDefault();
          return runWithLoadingButton(
            '[data-stats-load-button]',
            '加载中...',
            loadAttendanceStats
          ).catch(error => renderIdentity(error.message));
        });
      }

      const rosterKeyword = query('[data-roster-keyword]');
      if (rosterKeyword) {
        rosterKeyword.addEventListener('input', event => {
          const target = event && event.target ? event.target : rosterKeyword;
          state.activityDetailRosterKeyword = target.value || '';
          renderRosterRows();
        });
      }

      const detailLogsKeyword = query('[data-activity-detail-logs-keyword]');
      if (detailLogsKeyword) {
        detailLogsKeyword.addEventListener('input', event => {
          const target = event && event.target ? event.target : detailLogsKeyword;
          state.activityDetailLogKeyword = target.value || '';
          renderActivityDetailLogRows();
        });
      }

      if (appRoot) {
        appRoot.addEventListener('click', event => {
          const navButton = event.target.closest('[data-nav-target]');
          if (navButton) {
            hideActivityContextMenu();
            setActiveAdminView(navButton.dataset.navTarget);
            return;
          }

          const button = event.target.closest('[data-action]');
          if (!button) {
            const row = event.target.closest('[data-activity-id]');
            if (row) {
              hideActivityContextMenu();
              selectActivity(row.dataset.activityId);
              return;
            }

            hideActivityContextMenu();
            return;
          }

          if (button.dataset.action === 'save-roles') {
            return runWithButtonElement(button, '保存中...', async () => {
              await saveRoles(button.dataset.openid);
              renderUsersStatus('角色已保存');
            }).catch(error => {
              const message = getErrorMessage(error);
              renderUsersStatus(message);
              renderIdentity(message);
            });
          }

          if (button.dataset.action === 'save-user-manager-alias') {
            return runWithButtonElement(button, '保存中...', async () => {
              await saveUserManagerAlias(button.dataset.targetOpenid);
              renderUsersStatus('备注已保存');
            }).catch(error => {
              const message = getErrorMessage(error);
              renderUsersStatus(message);
              renderIdentity(message);
            });
          }

          if (button.dataset.action === 'close-activity-detail') {
            hideActivityContextMenu();
            closeActivityDetail();
            return;
          }

          if (button.dataset.action === 'load-activity-detail') {
            hideActivityContextMenu();
            return loadActivityDetail(button.dataset.activityId).catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'confirm-activity') {
            hideActivityContextMenu();
            return runWithButtonElement(button, '确认中...', () =>
              confirmActivity(button.dataset.activityId)
            ).catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'toggle-attendance') {
            return toggleAttendance(button.dataset.registrationId, button.dataset.nextStatus)
              .catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'save-manager-alias') {
            return saveManagerAlias(button.dataset.targetOpenid)
              .catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'export-roster') {
            return exportRoster().catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'load-activity-logs') {
            return loadActivityLogs().catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'load-notification-logs') {
            return loadNotificationLogs().catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'restart-login') {
            return beginWebAdminLogin().catch(error => renderLoginStatus(getErrorMessage(error)));
          }

          if (button.dataset.action === 'logout') {
            return logoutWebAdmin().catch(error => renderIdentity(error.message));
          }
        });

        appRoot.addEventListener('contextmenu', event => {
          const row = event.target.closest('[data-activity-id]');
          if (!row) {
            hideActivityContextMenu();
            return;
          }

          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }

          showActivityContextMenu(row.dataset.activityId, event.clientX, event.clientY);
        });
      }
    }

    async function start() {
      if (!appRoot) {
        throw new Error('admin-app root is required');
      }

      bindEvents();
      if (state.webAdminSessionToken) {
        if (api && typeof api.setWebAdminSessionToken === 'function') {
          api.setWebAdminSessionToken(state.webAdminSessionToken);
        }
        return loadWorkspace();
      }

      await beginWebAdminLogin();
      return state;
    }

    return {
      beginWebAdminLogin,
      exportRoster,
      loadActivityDetail,
      loadActivityLogs,
      loadAttendanceStats,
      loadNotificationLogs,
      pollWebAdminLogin,
      logoutWebAdmin,
      searchUsers,
      searchActivities,
      setActiveAdminView,
      start,
      state
    };
  }

  function getErrorMessage(error) {
    if (!error) {
      return 'Unknown error';
    }

    if (typeof error === 'string') {
      return error;
    }

    const message = error.message || error.errMsg || error.msg;
    if (message) {
      return String(message);
    }

    try {
      return JSON.stringify(error);
    } catch (jsonError) {
      return String(error);
    }
  }

  async function startBrowserApp(browserRoot = root) {
    const doc = browserRoot && browserRoot.document;
    const appRoot = doc && typeof doc.getElementById === 'function'
      ? doc.getElementById('admin-app')
      : null;

    if (!appRoot || !browserRoot || !browserRoot.WebAdminApp) {
      return null;
    }

    const showError = error => {
      const identity = appRoot.querySelector('[data-view="identity"]');
      if (identity) {
        identity.textContent = getErrorMessage(error);
      }
    };

    try {
      const runtimeReady = browserRoot.webAdminRuntimeReady;
      if (runtimeReady && typeof runtimeReady.then === 'function') {
        await runtimeReady;
      }

      return await browserRoot.WebAdminApp
        .createWebAdminApp({ appRoot, runtimeRoot: browserRoot })
        .start();
    } catch (error) {
      showError(error);
      return null;
    }
  }

  return {
    createWebAdminApp,
    startBrowserApp
  };
});

if (typeof window !== 'undefined' && window.document) {
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.WebAdminApp || typeof window.WebAdminApp.startBrowserApp !== 'function') {
      return;
    }

    window.WebAdminApp.startBrowserApp(window);
  });
}
