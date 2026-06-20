(function initApi(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.WebAdminApi = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function apiFactory(root) {
  function unwrapCloudFunctionResult(value) {
    if (value && Object.prototype.hasOwnProperty.call(value, 'result')) {
      return value.result;
    }

    return value;
  }

  function createDefaultCallFunction(runtimeRoot = root) {
    if (
      runtimeRoot.wx &&
      runtimeRoot.wx.cloud &&
      typeof runtimeRoot.wx.cloud.callFunction === 'function'
    ) {
      return (name, data) =>
        runtimeRoot.wx.cloud.callFunction({ name, data }).then(unwrapCloudFunctionResult);
    }

    if (
      runtimeRoot.cloudbaseApp &&
      typeof runtimeRoot.cloudbaseApp.callFunction === 'function'
    ) {
      return (name, data) =>
        runtimeRoot.cloudbaseApp.callFunction({ name, data }).then(unwrapCloudFunctionResult);
    }

    throw new Error('CloudBase callFunction adapter is not configured');
  }

  function createApiClient(callFunction, options = {}) {
    if (typeof callFunction !== 'function') {
      throw new Error('callFunction adapter is required');
    }

    let webAdminSessionToken = String(
      options.webAdminSessionToken || options.sessionToken || ''
    );

    async function invoke(name, data = {}) {
      const response = await callFunction(name, data);
      return unwrapCloudFunctionResult(response);
    }

    function getWebAdminSessionToken() {
      if (typeof options.getWebAdminSessionToken === 'function') {
        return String(options.getWebAdminSessionToken() || '');
      }

      return webAdminSessionToken;
    }

    function withWebAdminSession(data = {}) {
      const token = getWebAdminSessionToken();
      return token
        ? {
            ...data,
            webAdminSessionToken: token
          }
        : data;
    }

    function isCloudFileId(value) {
      return typeof value === 'string' && value.trim().startsWith('cloud://');
    }

    function getStorageApp() {
      return (
        options.cloudbaseApp ||
        (options.runtimeRoot && options.runtimeRoot.cloudbaseApp) ||
        (root && root.cloudbaseApp) ||
        null
      );
    }

    async function resolveFileUrls(fileIds = []) {
      const uniqueFileIds = Array.from(
        new Set((Array.isArray(fileIds) ? fileIds : []).map(String).filter(isCloudFileId))
      );

      if (!uniqueFileIds.length) {
        return {};
      }

      const app = getStorageApp();
      if (!app || typeof app.getTempFileURL !== 'function') {
        return {};
      }

      const response = await app.getTempFileURL({ fileList: uniqueFileIds });
      const fileList =
        (response && Array.isArray(response.fileList) && response.fileList) ||
        (response && response.result && Array.isArray(response.result.fileList) && response.result.fileList) ||
        [];

      return fileList.reduce((map, file) => {
        const fileId = String(file.fileID || file.fileId || '').trim();
        const tempUrl = String(file.tempFileURL || file.tempFileUrl || '').trim();
        if (fileId && tempUrl) {
          map[fileId] = tempUrl;
        }
        return map;
      }, {});
    }

    return {
      setWebAdminSessionToken(token) {
        webAdminSessionToken = String(token || '');
      },

      createWebAdminLogin() {
        return invoke('createWebAdminLogin', {});
      },

      async pollWebAdminLogin(loginId, pollToken) {
        const result = await invoke('pollWebAdminLogin', {
          loginId,
          pollToken
        });

        if (result && result.status === 'confirmed' && result.webAdminSessionToken) {
          webAdminSessionToken = result.webAdminSessionToken;
        }

        return result;
      },

      async getCurrentUser() {
        const result = await invoke('ensureUserProfile', withWebAdminSession({}));
        return result.user || result;
      },

      listUsers(params = {}) {
        return invoke('listUsers', withWebAdminSession({
          keyword: params.keyword || '',
          role: params.role || '',
          limit: params.limit || 20,
          skip: params.skip || 0
        }));
      },

      updateUserRoles(targetOpenId, roles) {
        return invoke('updateUserRoles', withWebAdminSession({
          targetOpenId,
          roles: Array.isArray(roles) ? roles : []
        }));
      },

      listActivities(params = {}) {
        return invoke('listActivities', withWebAdminSession({
          ...params
        }));
      },

      getActivityDetail(activityId) {
        return invoke('getActivityDetail', withWebAdminSession({ activityId }));
      },

      confirmActivity(activityId) {
        return invoke('notifyActivityParticipants', withWebAdminSession({
          activityId,
          notificationType: 'proceeding'
        }));
      },

      setRegistrationAttendance(activityId, registrationId, attendanceStatus) {
        return invoke('setRegistrationAttendance', withWebAdminSession({
          activityId,
          registrationId,
          attendanceStatus
        }));
      },

      updateParticipantManagerAlias(activityId, targetOpenId, managerAlias) {
        return invoke('updateParticipantManagerAlias', withWebAdminSession({
          activityId,
          targetOpenId,
          managerAlias
        }));
      },

      updateUserManagerAlias(targetOpenId, managerAlias) {
        return invoke('updateUserManagerAlias', withWebAdminSession({
          targetOpenId,
          managerAlias
        }));
      },

      getAttendanceStats(params = {}) {
        return invoke('getAttendanceStats', withWebAdminSession({
          ...params
        }));
      },

      exportActivityRoster(activityId) {
        return invoke('exportActivityRoster', withWebAdminSession({ activityId }));
      },

      listActivityLogs(params = {}) {
        return invoke('listActivityLogs', withWebAdminSession({
          ...params
        }));
      },

      listNotificationLogs(params = {}) {
        return invoke('listNotificationLogs', withWebAdminSession({
          ...params
        }));
      },

      resolveFileUrls
    };
  }

  return {
    createApiClient,
    createDefaultCallFunction
  };
});
