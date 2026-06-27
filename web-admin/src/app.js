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
  const ATTENDANCE_STATS_EMPTY_TEXT = '统计已开始且未取消/未删除的活动；当前范围内没有出勤记录。';
  const ADMIN_VIEW_TITLES = {
    users: '用户管理',
    activities: '活动管理',
    'attendance-stats': '出勤统计'
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
    return roles.isAdmin(user)
      ? ['users', 'activities', 'attendance-stats']
      : ['activities', 'attendance-stats'];
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

  function shortenOpenId(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }

    if (text.length <= 12) {
      return text;
    }

    return `${text.slice(0, 6)}...${text.slice(-4)}`;
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
        runtimeRoot: options.runtimeRoot,
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
      attendanceDetailRows: [],
      attendanceDetailTitle: '',
      activityLogRows: [],
      activityDetailLogRows: [],
      activityDetailRosterKeyword: '',
      activityDetailLogKeyword: '',
      activityDetailLoading: false,
      activitySummary: '',
      textEdit: null,
      notificationLogRows: [],
      logStatus: '',
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

    function renderLogStatus(message) {
      state.logStatus = message || '';
      const status = query('[data-logs-status]');
      if (status) {
        status.textContent = state.logStatus;
        setHidden(status, !state.logStatus);
      }
    }

    function isCloudFileId(value) {
      return typeof value === 'string' && value.trim().startsWith('cloud://');
    }

    async function resolveAvatarRows(rows = []) {
      const cloudAvatarUrls = Array.from(
        new Set(rows.map(row => row.avatarUrl).filter(isCloudFileId))
      );

      if (!cloudAvatarUrls.length || !api || typeof api.resolveFileUrls !== 'function') {
        return rows;
      }

      try {
        const urlByFileId = await api.resolveFileUrls(cloudAvatarUrls);
        return rows.map(row => {
          const resolvedAvatarUrl = urlByFileId[row.avatarUrl];
          return resolvedAvatarUrl
            ? {
                ...row,
                avatarSourceUrl: row.avatarUrl,
                avatarUrl: resolvedAvatarUrl
              }
            : row;
        });
      } catch (error) {
        return rows;
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
      const count = query('[data-users-count]');
      if (count) {
        count.textContent = `共 ${state.rows.length} 行`;
      }

      if (!table) {
        return;
      }

      table.innerHTML = state.rows
        .map((row, index) => {
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
            `<td>${index + 1}</td>` +
            `<td>${renderUserCell(row)}</td>` +
            `<td><code>${escapeHtml(row.openid)}</code></td>` +
            `<td><div class="manager-alias-control">` +
            `<input type="text" data-user-manager-alias="${escapeHtml(row.openid)}" ` +
            `value="${escapeHtml(row.managerAlias)}" maxlength="128" />` +
            `<button type="button" data-action="save-user-manager-alias" ` +
            `data-target-openid="${escapeHtml(row.openid)}" aria-label="保存用户备注">保存备注</button>` +
            `</div></td>` +
            `<td>${escapeHtml(formatRoleList(row.rolesText))}</td>` +
            `<td><div class="role-management-control">` +
            `<div class="role-toggle-list">${controls}</div>` +
            `<button type="button" data-action="save-roles" ` +
            `data-openid="${escapeHtml(row.openid)}" aria-label="保存用户角色">保存</button>` +
            `</div></td>` +
            `</tr>`
          );
        })
        .join('');
    }

    function getAvatarText(row = {}) {
      const source = String(row.displayName || row.signupName || row.openid || '').trim();
      return source ? Array.from(source)[0].toUpperCase() : '?';
    }

    function renderAvatarNameCell(row = {}, displayName) {
      const name = String(displayName || row.displayName || row.signupName || row.openid || '').trim();
      const avatarUrl = String(row.avatarUrl || '').trim();
      const avatarSourceUrl = String(row.avatarSourceUrl || row.avatarUrl || '').trim();
      const fallbackText = getAvatarText({
        ...row,
        displayName: name
      });
      const avatar = avatarUrl
        ? (
          `<button type="button" class="user-avatar-button" ` +
          `data-action="preview-user-avatar" ` +
          `data-avatar-url="${escapeHtml(avatarUrl)}" ` +
          `data-avatar-source-url="${escapeHtml(avatarSourceUrl)}" ` +
          `data-avatar-name="${escapeHtml(name)}" ` +
          `aria-label="查看${escapeHtml(name)}头像">` +
          `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" ` +
          `onerror="this.hidden=true;this.parentNode.classList.add('is-broken');` +
          `this.parentNode.disabled=true;this.parentNode.removeAttribute('data-action');` +
          `this.parentNode.removeAttribute('data-avatar-url')" />` +
          `<span class="user-avatar-fallback-text">${escapeHtml(fallbackText)}</span>` +
          `</button>`
        )
        : `<span class="user-avatar-fallback">${escapeHtml(fallbackText)}</span>`;

      return (
        `<div class="user-display">` +
        avatar +
        `<span class="user-display-name">${escapeHtml(name)}</span>` +
        `</div>`
      );
    }

    function renderUserCell(row = {}) {
      const displayName = String(row.displayName || row.openid || '').trim();

      return (
        `<div class="user-display">` +
        `<span class="user-display-name">${escapeHtml(displayName)}</span>` +
        `</div>`
      );
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
      const organizerKeyword = query('[name="activityOrganizerKeyword"]');
      const organizerOpenId = query('[name="activityOrganizerOpenId"]');
      const startAtFrom = query('[name="activityStartAtFrom"]');
      const startAtTo = query('[name="activityStartAtTo"]');

      return activityUi.buildActivitySearchParams({
        keyword: keyword ? keyword.value : '',
        status: status ? status.value : '',
        organizerKeyword: organizerKeyword ? organizerKeyword.value : '',
        organizerOpenId: organizerOpenId ? organizerOpenId.value : '',
        startAtFrom: startAtFrom ? startAtFrom.value : '',
        startAtTo: startAtTo ? startAtTo.value : '',
        limit: 20,
        skip: 0
      });
    }

    function getActivityOrganizerOptionLabel(row) {
      return (
        String(row.organizerManagerAlias || '').trim() ||
        String(row.organizerName || '').trim() ||
        ''
      );
    }

    function renderActivityOrganizerOptions() {
      const datalist = query('[data-activity-organizer-options]');
      if (!datalist) {
        return;
      }

      const seen = new Set();
      datalist.innerHTML = (state.activities || [])
        .map(getActivityOrganizerOptionLabel)
        .filter(Boolean)
        .filter(label => {
          if (seen.has(label)) {
            return false;
          }

          seen.add(label);
          return true;
        })
        .map(label => `<option value="${escapeHtml(label)}"></option>`)
        .join('');
    }

    function renderActivityRows() {
      const table = query('[data-activities-table]');
      const count = query('[data-activities-count]');
      if (count) {
        count.textContent = `共 ${state.activities.length} 行`;
      }

      if (!table) {
        return;
      }

      table.innerHTML = state.activities
        .map((row, index) => {
          const selected = row.activityId && row.activityId === state.selectedActivityId;
          const selectedAttributes = selected
            ? ` class="is-selected" aria-selected="true"`
            : ` aria-selected="false"`;

          return (
            `<tr data-activity-id="${escapeHtml(row.activityId)}" ` +
            `data-can-confirm-proceeding="${row.canConfirmProceeding ? 'true' : 'false'}"` +
            selectedAttributes +
            `>` +
            `<td>${index + 1}</td>` +
            `<td>${escapeHtml(row.title)}</td>` +
            `<td>${escapeHtml(row.activityTypeText)}</td>` +
            `<td>${escapeHtml(row.startAt)}</td>` +
            `<td>${escapeHtml(formatStatusText(row.statusText))}</td>` +
            `<td>${renderPersonCell(row.organizerDisplayName, row.organizerOpenId)}</td>` +
            `<td>${escapeHtml(row.joinedCount)}</td>` +
            `<td>${escapeHtml(row.signupLimitTotal)}</td>` +
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
          row.performanceDescription,
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
      const rows = getFilteredRosterRows();
      const count = query('[data-roster-count]');
      if (count) {
        count.textContent = `共 ${rows.length} 行`;
      }

      if (!table) {
        return;
      }

      table.innerHTML = rows
        .map((row, index) => (
          `<tr data-registration-id="${escapeHtml(row.registrationId)}">` +
          `<td>${index + 1}</td>` +
          `<td>${escapeHtml(row.teamName)}</td>` +
          `<td>${renderAvatarNameCell(row, row.signupName)}</td>` +
          `<td>${renderEditableTextControl(row.managerAlias, 'edit-manager-alias', {
            'target-openid': row.userOpenId
          }, row.proxyRegistration)}</td>` +
          `<td>${renderEditableTextControl(row.performanceDescription, 'edit-performance-description', {
            'registration-id': row.registrationId
          })}</td>` +
          `<td>${escapeHtml(formatDelimitedLabels(row.preferredPositions, POSITION_LABELS))}</td>` +
          `<td>${row.proxyRegistration ? '是' : '否'}</td>` +
          `<td><div class="attendance-status-control">` +
          `<span>${escapeHtml(formatStatusText(row.attendanceStatus))}</span>` +
          `<button type="button" data-action="toggle-attendance" ` +
          `data-registration-id="${escapeHtml(row.registrationId)}" ` +
          `data-next-status="${escapeHtml(row.nextAttendanceStatus)}">` +
          `${escapeHtml(formatAttendanceAction(row.nextAttendanceStatus))}` +
          `</button>` +
          `</div></td>` +
          `</tr>`
        ))
        .join('');
    }

    function renderEditableTextControl(value, action, dataAttributes = {}, disabled = false) {
      const text = String(value || '').trim();
      const display = text
        ? escapeHtml(text)
        : '<span class="editable-text-empty">未填写</span>';
      const attrs = Object.keys(dataAttributes)
        .map(key => `data-${key}="${escapeHtml(dataAttributes[key])}"`)
        .join(' ');

      return (
        `<div class="editable-text-control">` +
        `<span class="editable-text-value" title="${escapeHtml(text)}">${display}</span>` +
        `<button type="button" class="editable-text-action" data-action="${escapeHtml(action)}" ${attrs} ` +
        `${disabled ? 'disabled ' : ''}>编辑</button>` +
        `</div>`
      );
    }

    function renderStatsRows() {
      const table = query('[data-attendance-stats-table]');
      const empty = query('[data-attendance-stats-empty]');
      const hasRows = state.statsRows.length > 0;
      const count = query('[data-attendance-stats-count]');
      if (count) {
        count.textContent = `共 ${state.statsRows.length} 行`;
      }

      if (empty) {
        empty.textContent = hasRows ? '' : ATTENDANCE_STATS_EMPTY_TEXT;
        setHidden(empty, hasRows);
      }

      if (!table) {
        return;
      }

      table.innerHTML = state.statsRows
        .map((row, index) => (
          `<tr data-attendance-stats-index="${index}" tabindex="0">` +
          `<td>${index + 1}</td>` +
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

    function renderAttendanceDetailRows() {
      const table = query('[data-attendance-detail-table]');
      const count = query('[data-attendance-detail-count]');
      const rows = state.attendanceDetailRows || [];

      if (count) {
        count.textContent = `共 ${rows.length} 行`;
      }

      if (!table) {
        return;
      }

      table.innerHTML = rows
        .map((row, index) => (
          `<tr>` +
          `<td>${index + 1}</td>` +
          `<td>${escapeHtml(row.activityTitle || row.activityId)}</td>` +
          `<td>${escapeHtml(row.startAt)}</td>` +
          `<td>${escapeHtml(row.signupName)}</td>` +
          `<td>${escapeHtml(row.managerAlias)}</td>` +
          `<td>${escapeHtml(formatStatusText(row.attendanceStatus))}</td>` +
          `</tr>`
        ))
        .join('');
    }

    function showAttendanceDetail(index) {
      const row = state.statsRows[Number(index)];
      const modal = query('[data-attendance-detail]');
      const title = query('[data-attendance-detail-title]');
      if (!row || !modal) {
        return;
      }

      const name = String(row.managerAlias || row.participantName || '').trim();
      state.attendanceDetailRows = Array.isArray(row.details) ? row.details : [];
      state.attendanceDetailTitle = name ? `${name} 出勤明细` : '出勤明细';

      if (title) {
        title.textContent = state.attendanceDetailTitle;
      }

      renderAttendanceDetailRows();
      setHidden(modal, false);
    }

    function closeAttendanceDetail() {
      state.attendanceDetailRows = [];
      state.attendanceDetailTitle = '';
      renderAttendanceDetailRows();
      setHidden(query('[data-attendance-detail]'), true);
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
          `<td>${renderActivityCell(row)}</td>` +
          `<td>${renderPersonCell(row.operatorDisplayName, row.operatorOpenId)}</td>` +
          `<td>${renderPersonCell(row.targetDisplayName || row.targetName, row.targetOpenId)}</td>` +
          `<td>${escapeHtml(row.createdAt)}</td>` +
          `</tr>`
        ))
        .join('');
    }

    function showUserAvatarPreview(avatarUrl, displayName) {
      const modal = query('[data-user-avatar-preview]');
      const image = query('[data-user-avatar-preview-image]');
      const url = String(avatarUrl || '').trim();
      const name = String(displayName || '').trim() || '用户头像';

      if (!modal || !image || !url) {
        return;
      }

      image.setAttribute('src', url);
      image.setAttribute('alt', name);
      setHidden(modal, false);
    }

    function closeUserAvatarPreview() {
      const modal = query('[data-user-avatar-preview]');
      const image = query('[data-user-avatar-preview-image]');

      if (image) {
        image.setAttribute('src', '');
        image.setAttribute('alt', '');
      }

      setHidden(modal, true);
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
          row.operatorName,
          row.operatorManagerAlias,
          row.operatorDisplayName,
          row.targetOpenId,
          row.targetName,
          row.targetManagerAlias,
          row.targetDisplayName,
          row.status,
          row.createdAt
        ], keyword)
      );
    }

    function renderActivityDetailLogRows() {
      const table = query('[data-activity-detail-logs-table]');
      const rows = getFilteredActivityDetailLogRows();
      const count = query('[data-activity-detail-logs-count]');
      if (count) {
        count.textContent = `共 ${rows.length} 行`;
      }

      if (!table) {
        return;
      }

      table.innerHTML = rows
        .map((row, index) => (
          `<tr>` +
          `<td>${index + 1}</td>` +
          `<td>${escapeHtml(row.summary || row.type)}</td>` +
          `<td>${renderPersonCell(row.operatorDisplayName, row.operatorOpenId)}</td>` +
          `<td>${escapeHtml(row.createdAt)}</td>` +
          `</tr>`
        ))
        .join('');
    }

    function renderPersonCell(displayName, openid) {
      const text = String(displayName || '').trim() || shortenOpenId(openid);
      const title = String(openid || '').trim();

      if (!title || text === title) {
        return escapeHtml(text);
      }

      return `<span class="person-display" title="${escapeHtml(title)}">${escapeHtml(text)}</span>`;
    }

    function renderActivityCell(row) {
      const text = String((row && row.activityTitle) || (row && row.activityId) || '').trim();
      const title = String((row && row.activityId) || '').trim();

      if (!text) {
        return '';
      }

      if (!title || text === title) {
        return escapeHtml(text);
      }

      return `<span class="activity-display" title="${escapeHtml(title)}">${escapeHtml(text)}</span>`;
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
          `<td>${renderActivityCell(row)}</td>` +
          `<td><code>${escapeHtml(row.targetOpenId)}</code></td>` +
          `<td>${escapeHtml(row.status)}</td>` +
          `<td>${escapeHtml(row.errorMessage)}</td>` +
          `<td>${escapeHtml(row.createdAt)}</td>` +
          `</tr>`
        ))
        .join('');
    }

    function renderActivitySummary() {
      const summaryDisplay = query('[data-activity-summary-display]');
      if (summaryDisplay) {
        const text = String(state.activitySummary || '').trim();
        summaryDisplay.innerHTML = text
          ? escapeHtml(text)
          : '<span class="editable-text-empty">未填写</span>';
      }
    }

    function renderTextEditDialog() {
      const modal = query('[data-text-edit-dialog]');
      const title = query('[data-text-edit-title]');
      const input = query('[data-text-edit-input]');
      const edit = state.textEdit;

      if (!modal) {
        return;
      }

      setHidden(modal, !edit);

      if (!edit) {
        if (title) {
          title.textContent = '';
        }

        if (input) {
          input.value = '';
          input.removeAttribute('maxlength');
        }

        return;
      }

      if (title) {
        title.textContent = edit.title;
      }

      if (input) {
        input.value = edit.value || '';
        if (edit.maxLength) {
          input.setAttribute('maxlength', String(edit.maxLength));
        } else {
          input.removeAttribute('maxlength');
        }
      }
    }

    function closeTextEditDialog() {
      state.textEdit = null;
      renderTextEditDialog();
    }

    function openTextEditDialog(edit) {
      state.textEdit = edit;
      renderTextEditDialog();
    }

    function openActivitySummaryEditor() {
      openTextEditDialog({
        kind: 'activitySummary',
        title: '编辑活动总结',
        value: state.activitySummary || '',
        maxLength: 2000
      });
    }

    function openManagerAliasEditor(targetOpenId) {
      const row = state.rosterRows.find(item => item.userOpenId === targetOpenId && !item.proxyRegistration);
      if (!row) {
        return;
      }

      openTextEditDialog({
        kind: 'managerAlias',
        targetId: targetOpenId,
        title: '编辑备注',
        value: row.managerAlias || '',
        maxLength: 128
      });
    }

    function openPerformanceDescriptionEditor(registrationId) {
      const row = state.rosterRows.find(item => item.registrationId === registrationId);
      if (!row) {
        return;
      }

      openTextEditDialog({
        kind: 'performanceDescription',
        targetId: registrationId,
        title: '编辑表现描述',
        value: row.performanceDescription || '',
        maxLength: 500
      });
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
      state.activityDetailLoading = false;
      closeTextEditDialog();
      renderActivityDetailLoading(false);
      setHidden(query('[data-activity-detail]'), true);
    }

    function renderActivityDetailLoading(isLoading = state.activityDetailLoading) {
      setHidden(query('[data-activity-detail-loading]'), !isLoading);
      setHidden(query('[data-activity-detail-body]'), isLoading);
      setHidden(query('[data-activity-summary-editor]'), isLoading);
    }

    function beginActivityDetailLoading(activityId) {
      const row = getActivityRowById(activityId);
      state.selectedActivityId = activityId;
      state.rosterRows = [];
      state.activityDetailLogRows = [];
      state.activityDetailLoading = true;
      state.activitySummary = '';
      state.textEdit = null;
      state.exportCsv = '';
      resetActivityDetailFilters();
      renderActivityRows();

      setHidden(query('[data-activity-detail]'), false);

      const title = query('[data-activity-title]');
      if (title) {
        title.textContent = row && row.title ? row.title : '正在加载活动详情...';
      }

      const output = query('[data-export-output]');
      if (output) {
        output.value = '';
      }

      renderRosterRows();
      renderActivityDetailLogRows();
      renderActivitySummary();
      renderTextEditDialog();
      renderActivityDetailLoading(true);
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
      renderActivityOrganizerOptions();
    }

    async function loadActivityDetail(activityId) {
      beginActivityDetailLoading(activityId);

      try {
        const [detail, activityDetailLogRows] = await Promise.all([
          api.getActivityDetail(activityId),
          loadAllActivityLogRows(activityId)
        ]);
        state.selectedActivityId = activityId;
        state.rosterRows = await resolveAvatarRows(activityUi.buildRosterRows(detail));
        state.activityDetailLogRows = activityDetailLogRows;
        state.activityDetailLoading = false;
        state.activitySummary = detail.activity && detail.activity.activitySummary
          ? String(detail.activity.activitySummary)
          : '';
        state.exportCsv = '';
        resetActivityDetailFilters();
        renderActivityRows();

        const title = query('[data-activity-title]');
        if (title) {
          title.textContent = detail.activity && detail.activity.title ? detail.activity.title : activityId;
        }

        const output = query('[data-export-output]');
        if (output) {
          output.value = '';
        }

        renderActivityDetailLoading(false);
        renderActivitySummary();
        renderRosterRows();
        renderActivityDetailLogRows();
      } catch (error) {
        state.activityDetailLoading = false;
        renderActivityDetailLoading(false);
        throw error;
      }
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

    async function refreshActivityDetailLogs(activityId) {
      state.activityDetailLogRows = await loadAllActivityLogRows(activityId);
      renderActivityDetailLogRows();
    }

    async function toggleAttendance(registrationId, nextStatus) {
      const activityId = getSelectedActivityId();
      if (!activityId || !registrationId || !nextStatus) {
        return;
      }

      const result = await api.setRegistrationAttendance(activityId, registrationId, nextStatus);
      const updatedRegistration = (result && result.registration) || {};
      const updatedRegistrationId =
        updatedRegistration.registrationId || updatedRegistration._id || registrationId;
      const attendanceStatus = updatedRegistration.attendanceStatus || nextStatus;

      state.rosterRows = state.rosterRows.map(row =>
        row.registrationId === updatedRegistrationId
          ? {
              ...row,
              attendanceStatus
            }
          : row
      );
      renderRosterRows();
      await refreshActivityDetailLogs(activityId);
    }

    async function saveManagerAlias(targetOpenId, nextValue) {
      const activityId = getSelectedActivityId();
      if (!activityId || !targetOpenId) {
        return;
      }

      const value = nextValue || '';
      const result = await api.updateParticipantManagerAlias(activityId, targetOpenId, value);
      const user = (result && result.user) || {};
      const managerAlias =
        Object.prototype.hasOwnProperty.call(user, 'managerAlias')
          ? user.managerAlias
          : value;

      state.rosterRows = state.rosterRows.map(row =>
        row.userOpenId === targetOpenId && !row.proxyRegistration
          ? {
              ...row,
              managerAlias
            }
          : row
      );
      renderRosterRows();
      await refreshActivityDetailLogs(activityId);
    }

    async function saveActivitySummary(nextValue) {
      const activityId = getSelectedActivityId();
      if (!activityId) {
        return;
      }

      const value = nextValue || '';
      const result = await api.updateActivityReview(activityId, {
        activitySummary: value
      });
      const activity = (result && result.activity) || {};
      state.activitySummary = Object.prototype.hasOwnProperty.call(activity, 'activitySummary')
        ? activity.activitySummary
        : value;
      renderActivitySummary();
      await refreshActivityDetailLogs(activityId);
    }

    async function savePerformanceDescription(registrationId, nextValue) {
      const activityId = getSelectedActivityId();
      if (!activityId || !registrationId) {
        return;
      }

      const value = nextValue || '';
      const result = await api.updateActivityReview(activityId, {
        registrationId,
        performanceDescription: value
      });
      const registration = (result && result.registration) || {};
      const performanceDescription = Object.prototype.hasOwnProperty.call(
        registration,
        'performanceDescription'
      )
        ? registration.performanceDescription
        : value;

      state.rosterRows = state.rosterRows.map(row =>
        row.registrationId === registrationId
          ? {
              ...row,
              performanceDescription
            }
          : row
      );
      renderRosterRows();
      await refreshActivityDetailLogs(activityId);
    }

    async function saveTextEdit() {
      const edit = state.textEdit;
      const input = query('[data-text-edit-input]');
      const value = input ? input.value || '' : '';

      if (!edit) {
        return;
      }

      if (edit.kind === 'activitySummary') {
        await saveActivitySummary(value);
      } else if (edit.kind === 'managerAlias') {
        await saveManagerAlias(edit.targetId, value);
      } else if (edit.kind === 'performanceDescription') {
        await savePerformanceDescription(edit.targetId, value);
      }

      closeTextEditDialog();
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
      const activityType = query('[name="statsActivityType"]');
      const result = await api.getAttendanceStats({
        startAt: startAt ? startAt.value : '',
        endAt: endAt ? endAt.value : '',
        activityType: activityType && activityType.value ? activityType.value : 'all'
      });
      state.statsRows = activityUi.buildStatsRows(result.items || result.rows || []);
      renderStatsRows();
    }

    function writeExportOutput(csv) {
      state.exportCsv = csv || '';

      const output = query('[data-export-output]');
      if (output) {
        output.value = state.exportCsv;
      }
    }

    function downloadCsv(filename, csv) {
      const content = `\uFEFF${csv || ''}`;
      const doc = runtimeBrowserRoot && runtimeBrowserRoot.document;
      const blobCtor = runtimeBrowserRoot && runtimeBrowserRoot.Blob;
      const urlApi = runtimeBrowserRoot && (runtimeBrowserRoot.URL || runtimeBrowserRoot.webkitURL);

      if (
        doc &&
        typeof doc.createElement === 'function' &&
        blobCtor &&
        urlApi &&
        typeof urlApi.createObjectURL === 'function'
      ) {
        const blob = new blobCtor([content], { type: 'text/csv;charset=utf-8' });
        const url = urlApi.createObjectURL(blob);
        const link = doc.createElement('a');
        link.href = url;
        link.download = filename;

        if (doc.body && typeof doc.body.appendChild === 'function') {
          doc.body.appendChild(link);
        }

        if (typeof link.click === 'function') {
          link.click();
        }

        if (link.parentNode && typeof link.parentNode.removeChild === 'function') {
          link.parentNode.removeChild(link);
        }

        if (typeof urlApi.revokeObjectURL === 'function') {
          urlApi.revokeObjectURL(url);
        }
      }

      writeExportOutput(csv);
    }

    function exportAttendanceStats() {
      if (!state.statsRows.length) {
        const empty = query('[data-attendance-stats-empty]');
        if (empty) {
          empty.textContent = '请先加载出勤统计后再导出。';
          setHidden(empty, false);
        }
        writeExportOutput('');
        return;
      }

      const rows = state.statsRows.map(row => ({
        参与者: row.participantName,
        备注: row.managerAlias,
        报名次数: row.signupCount,
        出勤: row.presentCount,
        缺勤: row.absentCount,
        出勤率: row.attendanceRateText
      }));
      const csv = activityUi.rowsToCsv(rows);
      downloadCsv('attendance-stats.csv', csv);
    }

    function exportActivityRosterView() {
      const rows = getFilteredRosterRows().map(row => ({
        队伍: row.teamName,
        报名名称: row.signupName,
        备注: row.managerAlias,
        表现描述: row.performanceDescription,
        位置偏好: formatDelimitedLabels(row.preferredPositions, POSITION_LABELS),
        代报名: row.proxyRegistration ? '是' : '否',
        出勤状态: formatStatusText(row.attendanceStatus)
      }));
      const csv = activityUi.rowsToCsv(rows);
      downloadCsv(`activity-roster-${getSelectedActivityId() || 'selected'}.csv`, csv);
    }

    function exportActivityLogsView() {
      const rows = getFilteredActivityDetailLogRows().map(row => ({
        操作: row.summary || row.type,
        操作人: row.operatorDisplayName,
        时间: row.createdAt
      }));
      const csv = activityUi.rowsToCsv(rows);
      downloadCsv(`activity-logs-${getSelectedActivityId() || 'selected'}.csv`, csv);
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
      state.attendanceDetailRows = [];
      state.attendanceDetailTitle = '';
      state.activityLogRows = [];
      state.activityDetailLogRows = [];
      state.activityDetailRosterKeyword = '';
      state.activityDetailLogKeyword = '';
      state.activityDetailLoading = false;
      state.activitySummary = '';
      state.notificationLogRows = [];
      state.exportCsv = '';
      hideActivityContextMenu();
      closeAttendanceDetail();

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
              if (Number(event.detail) >= 2) {
                return loadActivityDetail(row.dataset.activityId).catch(error => renderIdentity(error.message));
              }

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

          if (button.dataset.action === 'preview-user-avatar') {
            showUserAvatarPreview(button.dataset.avatarUrl, button.dataset.avatarName);
            return;
          }

          if (button.dataset.action === 'close-user-avatar-preview') {
            closeUserAvatarPreview();
            return;
          }

          if (button.dataset.action === 'close-attendance-detail') {
            closeAttendanceDetail();
            return;
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
            return runWithButtonElement(button, '更新中...', () =>
              toggleAttendance(button.dataset.registrationId, button.dataset.nextStatus)
            )
              .catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'edit-manager-alias') {
            openManagerAliasEditor(button.dataset.targetOpenid);
            return;
          }

          if (button.dataset.action === 'edit-activity-summary') {
            openActivitySummaryEditor();
            return;
          }

          if (button.dataset.action === 'edit-performance-description') {
            openPerformanceDescriptionEditor(button.dataset.registrationId);
            return;
          }

          if (button.dataset.action === 'cancel-text-edit') {
            closeTextEditDialog();
            return;
          }

          if (button.dataset.action === 'save-text-edit') {
            return runWithButtonElement(button, '保存中...', saveTextEdit)
              .catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'export-attendance-stats') {
            exportAttendanceStats();
            return;
          }

          if (button.dataset.action === 'export-activity-roster-view') {
            exportActivityRosterView();
            return;
          }

          if (button.dataset.action === 'export-activity-logs-view') {
            exportActivityLogsView();
            return;
          }

          if (button.dataset.action === 'load-activity-logs') {
            return runWithButtonElement(button, '加载中...', async () => {
              renderLogStatus('操作日志加载中...');
              await loadActivityLogs();
              renderLogStatus('操作日志已加载');
            }).catch(error => {
              const message = getErrorMessage(error);
              renderLogStatus(message);
              renderIdentity(message);
            });
          }

          if (button.dataset.action === 'load-notification-logs') {
            return runWithButtonElement(button, '加载中...', async () => {
              renderLogStatus('通知日志加载中...');
              await loadNotificationLogs();
              renderLogStatus('通知日志已加载');
            }).catch(error => {
              const message = getErrorMessage(error);
              renderLogStatus(message);
              renderIdentity(message);
            });
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

        appRoot.addEventListener('dblclick', event => {
          const statsRow = event.target.closest('[data-attendance-stats-index]');
          if (statsRow) {
            showAttendanceDetail(statsRow.dataset.attendanceStatsIndex);
            return;
          }

          const row = event.target.closest('[data-activity-id]');
          if (!row) {
            return;
          }

          hideActivityContextMenu();
          if (state.activityDetailLoading && state.selectedActivityId === row.dataset.activityId) {
            return;
          }

          return loadActivityDetail(row.dataset.activityId).catch(error => renderIdentity(error.message));
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
      exportAttendanceStats,
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
