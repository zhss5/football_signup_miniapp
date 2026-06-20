const fs = require('fs');
const path = require('path');

const WEB_ADMIN_ASSET_VERSION = '20260620-avatar-lifecycle-stats';

test('web admin static shell defaults to Chinese visible copy', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');

  expect(html).toContain('<html lang="zh-CN">');
  expect(html).toContain('<title>足球报名后台</title>');
  expect(html).toContain('id="admin-app"');
  expect(html).toContain('data-view="identity"');
  expect(html).toContain('正在检查身份...');
  expect(html).toContain('data-view="login"');
  expect(html).toContain('后台管理登录');
  expect(html).toContain('打开小程序，进入“我的”，点击“后台登录”，扫描此二维码。');
  expect(html).toContain('data-login-qr');
  expect(html).toContain('data-login-payload');
  expect(html).toContain('data-action="restart-login"');
  expect(html).toContain('重试');
  expect(html).toContain('data-view="forbidden"');
  expect(html).toContain('需要组织者或管理员权限。');
  expect(html).toContain('data-view="workspace"');
  expect(html).toContain(`src="./src/app.js?v=${WEB_ADMIN_ASSET_VERSION}"`);
});

test('web admin workspace uses a Chinese sidebar plus independent content views', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');

  expect(html).toContain('data-admin-layout');
  expect(html).toContain('data-admin-sidebar');
  expect(html).toContain('data-admin-content');
  expect(html).toContain('data-current-user-summary');
  expect(html).toContain('data-current-user-openid');
  expect(html).toContain('data-action="logout"');
  expect(html).toContain('data-nav-target="users"');
  expect(html).toContain('data-nav-target="activities"');
  expect(html).toContain('data-nav-target="attendance-stats"');
  expect(html).toContain('data-nav-target="logs"');
  expect(html).toContain('data-admin-view="users"');
  expect(html).toContain('data-admin-view="activities"');
  expect(html).toContain('data-admin-view="attendance-stats"');
  expect(html).toContain('data-admin-view="logs"');
  expect(html).toContain('用户管理');
  expect(html).toContain('活动管理');
  expect(html).toContain('出勤统计');
  expect(html).toContain('全局日志');
  expect(html).not.toContain('data-nav-target="exports"');
  expect(html).not.toContain('data-admin-view="exports"');
  expect(html).not.toContain('名单导出');
});

test('web admin static shell keeps existing forms and action hooks with Chinese labels', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'web-admin/index.html'), 'utf8');

  expect(html).toContain('data-action="search-users"');
  expect(html).toContain('data-users-search-button');
  expect(html).toContain('data-user-avatar-preview');
  expect(html).toContain('data-user-avatar-preview-image');
  expect(html).toContain('data-action="close-user-avatar-preview"');
  const usersTableStart = html.indexOf('class="data-table users-table"');
  const usersTableEnd = html.indexOf('<tbody data-users-table>', usersTableStart);
  const usersHeaderBlock = usersTableStart >= 0 && usersTableEnd > usersTableStart
    ? html.slice(usersTableStart, usersTableEnd)
    : '';
  expect((usersHeaderBlock.match(/<th>/g) || []).length).toBe(5);
  expect(usersHeaderBlock).not.toContain('<th>操作</th>');
  expect(html).toContain('data-activities-search-button');
  expect(html).toContain('data-stats-load-button');
  expect(html).toContain('data-role-filter');
  expect(html).toContain('data-role="organizer"');
  expect(html).toContain('data-role="admin"');
  expect(html).toContain('data-action="search-activities"');
  expect(html).toContain('data-action="load-attendance-stats"');
  expect(html).toContain('data-action="export-attendance-stats"');
  expect(html).toContain('导出出勤统计 CSV');
  expect(html).not.toContain('data-attendance-import-file');
  expect(html).not.toContain('data-attendance-import-status');
  expect(html).not.toContain('导入Excel/CSV');
  expect(html).toContain('data-attendance-stats-empty');
  expect(html).toContain('data-activity-context-menu');
  expect(html).toContain('role="menu"');
  expect(html).toContain('class="activity-detail-modal"');
  expect(html).toContain('role="dialog"');
  expect(html).toContain('data-action="close-activity-detail"');
  expect(html).toContain('data-roster-keyword');
  expect(html).toContain('data-activity-detail-logs-keyword');
  expect(html).toContain('data-action="export-activity-roster-view"');
  expect(html).toContain('data-action="export-activity-logs-view"');
  expect(html).toContain('data-activity-detail-loading');
  expect(html).toContain('正在加载活动详情...');
  expect(html).toContain('activity-detail-body');
  expect(html).toContain('data-activity-detail-body');
  expect(html).toContain('导出CSV');
  expect(html).toContain('活动报名人列表');
  expect(html).toContain('data-activity-detail-logs-table');
  expect(html).toContain('报名活动流水');
  expect(html).toContain('仅统计已确认举行活动');
  const statsStart = html.indexOf('data-admin-view="attendance-stats"');
  const logsStart = html.indexOf('data-admin-view="logs"', statsStart);
  const statsBlock = statsStart >= 0 && logsStart > statsStart
    ? html.slice(statsStart, logsStart)
    : '';
  expect(statsBlock).toContain('<th>备注</th>');
  expect(html).not.toContain('data-action="export-roster"');
  expect(html).toContain('data-action="load-activity-logs"');
  expect(html).toContain('data-action="load-notification-logs"');
  expect(html).toContain('<th>活动</th>');
  expect(html).toContain('关键词');
  expect(html).toContain('角色');
  expect(html).toContain('搜索');
  expect(html).toContain('出勤状态');
  expect(html).toContain('加载操作日志');
  expect((html.match(/<th>备注<\/th>/g) || []).length).toBeGreaterThanOrEqual(2);
  expect(html).not.toContain('管理识别名');
});

test('web admin search buttons have loading spinner styling', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'web-admin/styles.css'), 'utf8');

  expect(css).toContain('.toolbar button.is-loading::before');
  expect(css).toContain('@keyframes admin-spin');
});

test('web admin login QR panel is centered instead of pinned to the right column', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'web-admin/styles.css'), 'utf8');

  expect(css).toContain('.login-panel');
  expect(css).toContain('grid-template-columns: minmax(0, 620px)');
  expect(css).toContain('justify-content: center');
  expect(css).toContain('justify-items: center');
  expect(css).toContain('.login-qr-card');
  expect(css).toContain('width: min(100%, 300px)');
  expect(css).not.toContain('grid-template-columns: minmax(0, 1fr) 300px');
});

test('web admin user management row actions have stable spacing', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'web-admin/styles.css'), 'utf8');

  expect(css).toContain('.manager-alias-control');
  expect(css).toContain('.role-management-control');
  expect(css).toContain('.user-display');
  expect(css).toContain('.user-avatar-button');
  expect(css).toContain('.avatar-preview-modal');
  expect(css).toContain('gap: 10px');
  expect(css).toContain('gap: 14px');
  expect(css).not.toContain('.table-actions');
  expect(css).toContain('.inline-status');
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
  expect(html).not.toContain('vendor/xlsx.full.min.js');
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

test('web admin shell uses a CloudBase-like console layout', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'web-admin/styles.css'), 'utf8');

  expect(css).toContain('max-width: none');
  expect(css).toContain('grid-template-columns: 188px minmax(0, 1fr)');
  expect(css).toContain('border-right: 1px solid #e5e8ef');
  expect(css).toContain('box-shadow: 0 1px 2px rgba(23, 32, 51, 0.04)');
});

test('activity detail dialog splits roster and logs into fixed half-height panes', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'web-admin/styles.css'), 'utf8');

  expect(css).toContain('width: min(1360px, calc(100vw - 48px))');
  expect(css).toContain('height: min(860px, calc(100vh - 48px))');
  expect(css).toContain('grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)');
  expect(css).toContain('.detail-subsection');
  expect(css).toContain('overflow: hidden');
  expect(css).toContain('.detail-table-scroll');
  expect(css).toContain('overflow: auto');
});

test('web admin test config targets only the test CloudBase environment', () => {
  const configPath = path.join(process.cwd(), 'web-admin/config.test.js');
  const config = fs.readFileSync(configPath, 'utf8');

  expect(config).toContain('cloudbase-miniapp-test-dfc753877');
  expect(config).not.toContain('cloudbase-d9g0gk6rk72cf55ab');
});
