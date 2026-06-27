const fs = require('fs');
const path = require('path');

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '../../../', relativePath), 'utf8');
}

describe('cover image ratio styles', () => {
  test('home activity cards render covers inside a shared 5:4 frame', () => {
    const content = readFile('miniprogram/components/activity-card/index.wxss');

    expect(content).toContain('.cover-frame');
    expect(content).toContain('padding-top: 80%;');
  });

  test('activity detail hero renders covers inside the same 5:4 frame', () => {
    const content = readFile('miniprogram/pages/activity-detail/index.wxss');

    expect(content).toContain('.hero-banner');
    expect(content).toContain('padding-top: 80%;');
  });

  test('create activity preview uses the same 5:4 frame so upload matches runtime display', () => {
    const content = readFile('miniprogram/pages/activity-create/index.wxss');

    expect(content).toContain('.image-preview-frame');
    expect(content).toContain('padding-top: 80%;');
  });
});
