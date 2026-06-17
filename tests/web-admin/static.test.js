const fs = require('fs');
const path = require('path');

const WEB_ADMIN_ASSET_VERSION = '20260617-admin-layout';

test('web admin static shell includes identity, QR login, and guarded workspace', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');

  expect(html).toContain('id="admin-app"');
  expect(html).toContain('data-view="identity"');
  expect(html).toContain('data-view="login"');
  expect(html).toContain('data-login-qr');
  expect(html).toContain('data-login-payload');
  expect(html).toContain('data-action="restart-login"');
  expect(html).toContain('data-view="forbidden"');
  expect(html).toContain('data-view="workspace"');
  expect(html).toContain(`src="./src/app.js?v=${WEB_ADMIN_ASSET_VERSION}"`);
});

test('web admin workspace uses a sidebar plus independent content views', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');

  expect(html).toContain('data-admin-layout');
  expect(html).toContain('data-admin-sidebar');
  expect(html).toContain('data-admin-content');
  expect(html).toContain('data-nav-target="users"');
  expect(html).toContain('data-nav-target="activities"');
  expect(html).toContain('data-nav-target="attendance-stats"');
  expect(html).toContain('data-nav-target="exports"');
  expect(html).toContain('data-nav-target="logs"');
  expect(html).toContain('data-admin-view="users"');
  expect(html).toContain('data-admin-view="activities"');
  expect(html).toContain('data-admin-view="attendance-stats"');
  expect(html).toContain('data-admin-view="exports"');
  expect(html).toContain('data-admin-view="logs"');
});

test('web admin static shell keeps existing forms and action hooks for API reuse', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');

  expect(html).toContain('data-action="search-users"');
  expect(html).toContain('data-role-filter');
  expect(html).toContain('data-role="organizer"');
  expect(html).toContain('data-role="admin"');
  expect(html).toContain('data-action="search-activities"');
  expect(html).toContain('data-action="load-attendance-stats"');
  expect(html).toContain('data-action="export-roster"');
  expect(html).toContain('data-action="load-activity-logs"');
  expect(html).toContain('data-action="load-notification-logs"');
});

test('web admin static shell loads the test CloudBase runtime before app startup', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');
  const cloudbaseSdkIndex = html.indexOf(
    'https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js'
  );
  const configIndex = html.indexOf(`src="./config.test.js?v=${WEB_ADMIN_ASSET_VERSION}"`);
  const runtimeIndex = html.indexOf(
    `src="./src/cloudbase-runtime.js?v=${WEB_ADMIN_ASSET_VERSION}"`
  );
  const apiIndex = html.indexOf(`src="./src/api.js?v=${WEB_ADMIN_ASSET_VERSION}"`);
  const appIndex = html.indexOf(`src="./src/app.js?v=${WEB_ADMIN_ASSET_VERSION}"`);
  const qrIndex = html.indexOf(`src="./vendor/qrcode.min.js?v=${WEB_ADMIN_ASSET_VERSION}"`);

  expect(cloudbaseSdkIndex).toBeGreaterThan(-1);
  expect(configIndex).toBeGreaterThan(cloudbaseSdkIndex);
  expect(runtimeIndex).toBeGreaterThan(configIndex);
  expect(apiIndex).toBeGreaterThan(runtimeIndex);
  expect(qrIndex).toBeGreaterThan(apiIndex);
  expect(appIndex).toBeGreaterThan(qrIndex);
});

test('web admin static shell vendors the QR renderer for hosted login smoke', () => {
  const vendorPath = path.join(process.cwd(), 'web-admin/vendor/qrcode.min.js');
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');

  expect(html).not.toContain('cdn.jsdelivr.net/npm/qrcode');
  expect(fs.existsSync(vendorPath)).toBe(true);
  expect(fs.statSync(vendorPath).size).toBeGreaterThan(1000);
});

test('web admin hidden views cannot be overridden by panel display styles', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'web-admin/styles.css'), 'utf8');

  expect(css).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important\s*;/);
});

test('web admin test config targets only the test CloudBase environment', () => {
  const configPath = path.join(process.cwd(), 'web-admin/config.test.js');
  const config = fs.readFileSync(configPath, 'utf8');

  expect(config).toContain('cloudbase-miniapp-test-dfc753877');
  expect(config).not.toContain('cloudbase-d9g0gk6rk72cf55ab');
});
