const fs = require('fs');
const path = require('path');

describe('signup sheet component', () => {
  let componentConfig;

  beforeEach(() => {
    componentConfig = null;
    global.Component = jest.fn(config => {
      componentConfig = config;
    });

    jest.resetModules();
    require('../../../miniprogram/components/signup-sheet/index');
  });

  test('declares a teamName property for the selected team label', () => {
    expect(componentConfig.properties.teamName).toBeDefined();
    expect(componentConfig.properties.teamName.type).toBe(String);
  });

  test('renders the selected team name in the sheet title', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/signup-sheet/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('{{teamName}}');
  });
});
