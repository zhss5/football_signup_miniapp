(function initApp(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./api'),
      require('./roles'),
      require('./user-management')
    );
    return;
  }

  root.WebAdminApp = factory(
    root.WebAdminApi,
    root.WebAdminRoles,
    root.WebAdminUserManagement
  );
})(typeof globalThis !== 'undefined' ? globalThis : this, function appFactory(apiModule, roles, users) {
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

  function createWebAdminApp(options = {}) {
    const runtimeRoot = options.root || (typeof document !== 'undefined' ? document : null);
    const appRoot = options.appRoot ||
      (runtimeRoot && runtimeRoot.getElementById
        ? runtimeRoot.getElementById('admin-app')
        : null);
    const api = options.api ||
      apiModule.createApiClient(apiModule.createDefaultCallFunction(options.runtimeRoot));
    const state = {
      currentUser: null,
      rows: [],
      hasMore: false,
      search: users.buildSearchParams({})
    };

    function query(selector) {
      return appRoot ? appRoot.querySelector(selector) : null;
    }

    function renderIdentity(message) {
      const identity = query('[data-view="identity"]');
      if (identity) {
        identity.textContent = message;
      }
    }

    function renderAccess(user) {
      const access = roles.buildAccessState(user);
      setHidden(query('[data-view="identity"]'), true);
      setHidden(query('[data-view="forbidden"]'), access.allowed);
      setHidden(query('[data-view="workspace"]'), !access.allowed);

      if (!access.allowed) {
        return false;
      }

      const label = query('[data-current-user]');
      if (label) {
        label.textContent = `${user._id || ''} (${access.roles.join(', ')})`;
      }

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

      if (appRoot) {
        appRoot.addEventListener('click', event => {
          const button = event.target.closest('[data-action="save-roles"]');
          if (!button) {
            return;
          }

          saveRoles(button.dataset.openid).catch(error => renderIdentity(error.message));
        });
      }
    }

    async function start() {
      if (!appRoot) {
        throw new Error('admin-app root is required');
      }

      bindEvents();
      renderIdentity('Checking identity...');
      state.currentUser = await api.getCurrentUser();

      if (!renderAccess(state.currentUser)) {
        return state;
      }

      await searchUsers();
      return state;
    }

    return {
      searchUsers,
      start,
      state
    };
  }

  return {
    createWebAdminApp
  };
});

if (typeof window !== 'undefined' && window.document) {
  window.addEventListener('DOMContentLoaded', () => {
    const root = window.document.getElementById('admin-app');
    if (!root || !window.WebAdminApp) {
      return;
    }

    const showError = error => {
      const identity = root.querySelector('[data-view="identity"]');
      if (identity) {
        identity.textContent = error.message;
      }
    };

    try {
      window.WebAdminApp.createWebAdminApp({ appRoot: root, runtimeRoot: window })
        .start()
        .catch(showError);
    } catch (error) {
      showError(error);
    }
  });
}
