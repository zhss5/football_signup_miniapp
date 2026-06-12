const { startBrowserApp } = require('../../web-admin/src/app');

function createBrowserRoot(runtimeReady) {
  const identity = {
    textContent: ''
  };
  const appRoot = {
    querySelector: jest.fn().mockReturnValue(identity)
  };
  const start = jest.fn().mockResolvedValue({});
  const createWebAdminApp = jest.fn().mockReturnValue({ start });
  const browserRoot = {
    document: {
      getElementById: jest.fn().mockReturnValue(appRoot)
    },
    WebAdminApp: {
      createWebAdminApp
    },
    webAdminRuntimeReady: runtimeReady
  };

  return {
    appRoot,
    browserRoot,
    createWebAdminApp,
    identity,
    start
  };
}

test('startBrowserApp waits for CloudBase runtime readiness before starting app', async () => {
  let resolveRuntime;
  const runtimeReady = new Promise(resolve => {
    resolveRuntime = resolve;
  });
  const { appRoot, browserRoot, createWebAdminApp, start } = createBrowserRoot(runtimeReady);

  const startPromise = startBrowserApp(browserRoot);

  expect(start).not.toHaveBeenCalled();
  resolveRuntime({ app: { callFunction: jest.fn() } });
  await startPromise;

  expect(createWebAdminApp).toHaveBeenCalledWith({
    appRoot,
    runtimeRoot: browserRoot
  });
  expect(start).toHaveBeenCalled();
});

test('startBrowserApp renders runtime initialization errors in identity panel', async () => {
  let rejectRuntime;
  const runtimeReady = new Promise((resolve, reject) => {
    rejectRuntime = reject;
  });
  const { browserRoot, identity, start } = createBrowserRoot(runtimeReady);

  const startPromise = startBrowserApp(browserRoot);
  rejectRuntime(new Error('CloudBase anonymous auth is not enabled'));
  await startPromise;

  expect(start).not.toHaveBeenCalled();
  expect(identity.textContent).toBe('CloudBase anonymous auth is not enabled');
});

test('startBrowserApp renders structured runtime errors instead of object placeholders', async () => {
  let rejectRuntime;
  const runtimeReady = new Promise((resolve, reject) => {
    rejectRuntime = reject;
  });
  const { browserRoot, identity, start } = createBrowserRoot(runtimeReady);

  const startPromise = startBrowserApp(browserRoot);
  rejectRuntime({
    code: 'AUTH_SOURCE_DISABLED',
    errMsg: 'anonymous login is disabled'
  });
  await startPromise;

  expect(start).not.toHaveBeenCalled();
  expect(identity.textContent).toContain('anonymous login is disabled');
  expect(identity.textContent).not.toBe('[object Object]');
});
