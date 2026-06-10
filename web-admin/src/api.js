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

  function createApiClient(callFunction) {
    if (typeof callFunction !== 'function') {
      throw new Error('callFunction adapter is required');
    }

    async function invoke(name, data = {}) {
      const response = await callFunction(name, data);
      return unwrapCloudFunctionResult(response);
    }

    return {
      async getCurrentUser() {
        const result = await invoke('ensureUserProfile', {});
        return result.user || result;
      },

      listUsers(params = {}) {
        return invoke('listUsers', {
          keyword: params.keyword || '',
          role: params.role || '',
          limit: params.limit || 20,
          skip: params.skip || 0
        });
      },

      updateUserRoles(targetOpenId, roles) {
        return invoke('updateUserRoles', {
          targetOpenId,
          roles: Array.isArray(roles) ? roles : []
        });
      },

      listActivities(params = {}) {
        return invoke('listActivities', {
          ...params
        });
      },

      getActivityDetail(activityId) {
        return invoke('getActivityDetail', { activityId });
      },

      setRegistrationAttendance(activityId, registrationId, attendanceStatus) {
        return invoke('setRegistrationAttendance', {
          activityId,
          registrationId,
          attendanceStatus
        });
      },

      updateParticipantManagerAlias(activityId, targetOpenId, managerAlias) {
        return invoke('updateParticipantManagerAlias', {
          activityId,
          targetOpenId,
          managerAlias
        });
      },

      getAttendanceStats(params = {}) {
        return invoke('getAttendanceStats', {
          ...params
        });
      },

      exportActivityRoster(activityId) {
        return invoke('exportActivityRoster', { activityId });
      },

      listActivityLogs(params = {}) {
        return invoke('listActivityLogs', {
          ...params
        });
      },

      listNotificationLogs(params = {}) {
        return invoke('listNotificationLogs', {
          ...params
        });
      }
    };
  }

  return {
    createApiClient,
    createDefaultCallFunction
  };
});
