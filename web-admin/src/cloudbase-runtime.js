(function initCloudBaseRuntime(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.WebAdminCloudBaseRuntime = factory(root);
  root.webAdminRuntimeReady = root.WebAdminCloudBaseRuntime.installCloudBaseRuntime(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function cloudBaseRuntimeFactory(root) {
  function trimValue(value) {
    return typeof value === 'string' ? value.trim() : value;
  }

  function getConfig(runtimeRoot) {
    return (runtimeRoot && runtimeRoot.WEB_ADMIN_CONFIG) || {};
  }

  function getConfigValue(config, keys, fallback) {
    for (const key of keys) {
      const value = trimValue(config[key]);
      if (value) {
        return value;
      }
    }

    return fallback;
  }

  function getAuthClient(app) {
    if (!app) {
      return null;
    }

    return typeof app.auth === 'function' ? app.auth() : app.auth;
  }

  async function signInIfNeeded(app, authMode) {
    if (authMode !== 'anonymous') {
      return;
    }

    const auth = getAuthClient(app);
    if (!auth || typeof auth.signInAnonymously !== 'function') {
      throw new Error('CloudBase anonymous auth is not available');
    }

    await auth.signInAnonymously();
  }

  async function createCloudBaseRuntime(runtimeRoot = root, options = {}) {
    const config = options.config || getConfig(runtimeRoot);
    const cloudbase = runtimeRoot && runtimeRoot.cloudbase;

    if (!cloudbase || typeof cloudbase.init !== 'function') {
      throw new Error('CloudBase Web SDK is not loaded');
    }

    const env = getConfigValue(config, ['CLOUD_ENV_ID', 'env', 'ENV_ID'], '');
    if (!env) {
      throw new Error('WEB_ADMIN_CONFIG.CLOUD_ENV_ID is required');
    }

    const region = getConfigValue(config, ['REGION', 'region'], 'ap-shanghai');
    const accessKey = getConfigValue(config, ['ACCESS_KEY', 'accessKey'], '');
    const authMode = getConfigValue(config, ['AUTH_MODE', 'authMode'], 'none');
    const initOptions = {
      env,
      region
    };

    if (accessKey) {
      initOptions.accessKey = accessKey;
    }

    const app = cloudbase.init(initOptions);
    await signInIfNeeded(app, authMode);

    return {
      app,
      authMode,
      config
    };
  }

  function installCloudBaseRuntime(runtimeRoot = root, options = {}) {
    if (
      !options.force &&
      runtimeRoot &&
      runtimeRoot.cloudbaseApp &&
      typeof runtimeRoot.cloudbaseApp.callFunction === 'function'
    ) {
      const runtime = {
        app: runtimeRoot.cloudbaseApp,
        authMode: 'injected',
        config: getConfig(runtimeRoot)
      };
      const ready = Promise.resolve(runtime);
      runtimeRoot.webAdminRuntimeReady = ready;
      return ready;
    }

    const ready = createCloudBaseRuntime(runtimeRoot, options)
      .then(runtime => {
        runtimeRoot.cloudbaseApp = runtime.app;
        runtimeRoot.webAdminCloudBaseRuntime = runtime;
        return runtime;
      })
      .catch(error => {
        runtimeRoot.webAdminRuntimeError = error;
        throw error;
      });

    runtimeRoot.webAdminRuntimeReady = ready;
    return ready;
  }

  return {
    createCloudBaseRuntime,
    installCloudBaseRuntime
  };
});
