const fs = require('fs');
const path = require('path');

test('web admin static shell includes identity, guard, search, and role controls', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');

  expect(html).toContain('id="admin-app"');
  expect(html).toContain('data-view="identity"');
  expect(html).toContain('data-view="forbidden"');
  expect(html).toContain('data-action="search-users"');
  expect(html).toContain('data-role-filter');
  expect(html).toContain('data-role="organizer"');
  expect(html).toContain('data-role="admin"');
  expect(html).toContain('data-view="activities"');
  expect(html).toContain('data-action="search-activities"');
  expect(html).toContain('data-action="load-attendance-stats"');
  expect(html).toContain('data-action="export-roster"');
  expect(html).toContain('data-action="load-activity-logs"');
  expect(html).toContain('data-action="load-notification-logs"');
  expect(html).toContain('src="./src/app.js?v=');
});

test('web admin static shell loads the test CloudBase runtime before app startup', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');
  const cloudbaseSdkIndex = html.indexOf(
    'https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js'
  );
  const configIndex = html.indexOf('src="./config.test.js?v=');
  const runtimeIndex = html.indexOf('src="./src/cloudbase-runtime.js?v=');
  const apiIndex = html.indexOf('src="./src/api.js?v=');
  const appIndex = html.indexOf('src="./src/app.js?v=');

  expect(cloudbaseSdkIndex).toBeGreaterThan(-1);
  expect(configIndex).toBeGreaterThan(cloudbaseSdkIndex);
  expect(runtimeIndex).toBeGreaterThan(configIndex);
  expect(apiIndex).toBeGreaterThan(runtimeIndex);
  expect(appIndex).toBeGreaterThan(apiIndex);
});

test('web admin test config targets only the test CloudBase environment', () => {
  const configPath = path.join(process.cwd(), 'web-admin/config.test.js');
  const config = fs.readFileSync(configPath, 'utf8');

  expect(config).toContain('cloudbase-miniapp-test-dfc753877');
  expect(config).not.toContain('cloudbase-d9g0gk6rk72cf55ab');
});
