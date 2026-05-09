const fs = require('fs');
const path = require('path');

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '../../../', relativePath), 'utf8');
}

describe('team kit color icon styles', () => {
  test('shared team kit style draws a shirt shape instead of a circular dot', () => {
    const content = readFile('miniprogram/styles/team-kit.wxss');

    expect(content).toContain('.team-kit-icon');
    expect(content).toContain('.team-kit-body');
    expect(content).toContain('.team-kit-sleeve');
    expect(content).toContain('.team-kit-sleeve-left');
    expect(content).toContain('.team-kit-sleeve-right');
    expect(content).not.toContain('border-radius: 50%;');
  });

  test('team kit style includes all ten color classes', () => {
    const content = readFile('miniprogram/styles/team-kit.wxss');

    [
      'green',
      'white',
      'red',
      'blue',
      'black',
      'yellow',
      'orange',
      'purple',
      'gray',
      'pink'
    ].forEach(colorKey => {
      expect(content).toContain(`.team-color-${colorKey} .team-kit-body`);
      expect(content).toContain(`.team-color-${colorKey} .team-kit-sleeve`);
    });
  });

  test('all team color surfaces import the shared kit style', () => {
    expect(readFile('miniprogram/components/team-editor/index.wxss')).toContain(
      '@import "../../styles/team-kit.wxss";'
    );
    expect(readFile('miniprogram/components/team-list/index.wxss')).toContain(
      '@import "../../styles/team-kit.wxss";'
    );
    expect(readFile('miniprogram/pages/activity-detail/index.wxss')).toContain(
      '@import "../../styles/team-kit.wxss";'
    );
  });
});
