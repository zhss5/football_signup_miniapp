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
  expect(html).toContain('src="./src/app.js"');
});
