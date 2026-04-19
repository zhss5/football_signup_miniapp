const fs = require('fs');
const path = require('path');

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '../../../', relativePath), 'utf8');
}

describe('activity create layout styles', () => {
  test('activity create inputs define explicit height and line-height to avoid clipped text', () => {
    const content = readFile('miniprogram/pages/activity-create/index.wxss');

    expect(content).toContain('height: 88rpx;');
    expect(content).toContain('line-height: 88rpx;');
    expect(content).toContain('padding: 0 20rpx;');
  });

  test('team editor inputs define explicit height and line-height to avoid clipped team names', () => {
    const content = readFile('miniprogram/components/team-editor/index.wxss');

    expect(content).toContain('height: 88rpx;');
    expect(content).toContain('line-height: 88rpx;');
    expect(content).toContain('padding: 0 18rpx;');
  });
});
