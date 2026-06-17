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
  const ADMIN_VIEW_TITLES = {
    users: 'User Management',
    activities: 'Activity Management',
    'attendance-stats': 'Attendance Stats',
    exports: 'Roster Export',
    logs: 'Logs'
  };

  function getAllowedAdminViews(user) {
    const operationalViews = ['activities', 'attendance-stats', 'exports', 'logs'];

    return roles.isAdmin(user)
      ? ['users', ...operationalViews]
      : operationalViews;
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
        renderLoginStatus('Unable to render QR code. Copy the payload and retry.');
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
      renderLoginStatus('Open the mini program and scan this code from My > Web Admin Login.');
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
        label.textContent = `${user._id || ''} (${access.roles.join(', ')})`;
      }

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
            .map(control => (
              `<label class="role-toggle">` +
              `<input type="checkbox" data-role="${control.role}" ` +
              `data-openid="${escapeHtml(row.openid)}" ` +
              `${control.checked ? 'checked ' : ''}` +
              `${control.disabled ? 'disabled ' : ''}/>` +
              `<span>${escapeHtml(control.role)}</span>` +
              `</label>`
            ))
            .join('');

          return (
            `<tr data-openid="${escapeHtml(row.openid)}">` +
            `<td>${escapeHtml(row.displayName)}</td>` +
            `<td><code>${escapeHtml(row.openid)}</code></td>` +
            `<td>${escapeHtml(row.rolesText)}</td>` +
            `<td>${controls}</td>` +
            `<td><button type="button" data-action="save-roles" ` +
            `data-openid="${escapeHtml(row.openid)}">Save</button></td>` +
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
        .map(row => (
          `<tr data-activity-id="${escapeHtml(row.activityId)}">` +
          `<td>${escapeHtml(row.title)}</td>` +
          `<td>${escapeHtml(row.startAt)}</td>` +
          `<td>${escapeHtml(row.statusText)}</td>` +
          `<td><code>${escapeHtml(row.organizerOpenId)}</code></td>` +
          `<td>${escapeHtml(row.joinedCount)}</td>` +
          `<td><button type="button" data-action="load-activity-detail" ` +
          `data-activity-id="${escapeHtml(row.activityId)}">Open</button></td>` +
          `</tr>`
        ))
        .join('');
    }

    function renderRosterRows() {
      const table = query('[data-roster-table]');
      if (!table) {
        return;
      }

      table.innerHTML = activityUi.buildAttendanceRows(state.rosterRows)
        .map(row => (
          `<tr data-registration-id="${escapeHtml(row.registrationId)}">` +
          `<td>${escapeHtml(row.teamName)}</td>` +
          `<td>${escapeHtml(row.signupName)}</td>` +
          `<td>` +
          `<input type="text" data-manager-alias="${escapeHtml(row.userOpenId)}" ` +
          `value="${escapeHtml(row.managerAlias)}" ${row.proxyRegistration ? 'disabled ' : ''}/>` +
          `</td>` +
          `<td>${escapeHtml(row.preferredPositions)}</td>` +
          `<td>${row.proxyRegistration ? 'Yes' : 'No'}</td>` +
          `<td>${escapeHtml(row.attendanceStatus)}</td>` +
          `<td>` +
          `<button type="button" data-action="toggle-attendance" ` +
          `data-registration-id="${escapeHtml(row.registrationId)}" ` +
          `data-next-status="${escapeHtml(row.nextAttendanceStatus)}">` +
          `${escapeHtml(row.nextAttendanceStatus)}` +
          `</button>` +
          `<button type="button" data-action="save-manager-alias" ` +
          `data-target-openid="${escapeHtml(row.userOpenId)}" ` +
          `${row.proxyRegistration ? 'disabled ' : ''}>Save Alias</button>` +
          `</td>` +
          `</tr>`
        ))
        .join('');
    }

    function renderStatsRows() {
      const table = query('[data-attendance-stats-table]');
      if (!table) {
        return;
      }

      table.innerHTML = state.statsRows
        .map(row => (
          `<tr>` +
          `<td>${escapeHtml(row.participantName)}</td>` +
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
          `<td>${escapeHtml(row.type)}</td>` +
          `<td><code>${escapeHtml(row.operatorOpenId)}</code></td>` +
          `<td><code>${escapeHtml(row.targetOpenId)}</code></td>` +
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

    async function searchActivities() {
      state.activitySearch = getActivityFormValues();
      const result = await api.listActivities(state.activitySearch);
      state.activities = activityUi.buildActivityRows(result.items || []);
      renderActivityRows();
    }

    async function loadActivityDetail(activityId) {
      const detail = await api.getActivityDetail(activityId);
      state.selectedActivityId = activityId;
      state.rosterRows = activityUi.buildRosterRows(detail);
      state.exportCsv = '';

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
        limit: 50,
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
      renderIdentity('Preparing web admin login...');
      const challenge = await api.createWebAdminLogin();
      state.loginChallenge = challenge;
      renderLoginChallenge(challenge);
      startLoginPolling();
      return challenge;
    }

    async function loadWorkspace() {
      renderIdentity('Checking identity...');
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
        renderLoginStatus('Waiting for confirmation in the mini program...');
        return result;
      }

      if (result.status === 'expired') {
        clearLoginPollTimer();
        renderLoginStatus('The login code expired. Click retry to create a new one.');
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
          searchUsers().catch(error => renderIdentity(error.message));
        });
      }

      const activitiesForm = query('[data-action="search-activities"]');
      if (activitiesForm) {
        activitiesForm.addEventListener('submit', event => {
          event.preventDefault();
          searchActivities().catch(error => renderIdentity(error.message));
        });
      }

      const statsForm = query('[data-action="load-attendance-stats"]');
      if (statsForm) {
        statsForm.addEventListener('submit', event => {
          event.preventDefault();
          loadAttendanceStats().catch(error => renderIdentity(error.message));
        });
      }

      if (appRoot) {
        appRoot.addEventListener('click', event => {
          const navButton = event.target.closest('[data-nav-target]');
          if (navButton) {
            setActiveAdminView(navButton.dataset.navTarget);
            return;
          }

          const button = event.target.closest('[data-action]');
          if (!button) {
            return;
          }

          if (button.dataset.action === 'save-roles') {
            saveRoles(button.dataset.openid).catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'load-activity-detail') {
            loadActivityDetail(button.dataset.activityId).catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'toggle-attendance') {
            toggleAttendance(button.dataset.registrationId, button.dataset.nextStatus)
              .catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'save-manager-alias') {
            saveManagerAlias(button.dataset.targetOpenid)
              .catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'export-roster') {
            exportRoster().catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'load-activity-logs') {
            loadActivityLogs().catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'load-notification-logs') {
            loadNotificationLogs().catch(error => renderIdentity(error.message));
          }

          if (button.dataset.action === 'restart-login') {
            beginWebAdminLogin().catch(error => renderLoginStatus(getErrorMessage(error)));
          }
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
