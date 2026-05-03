const fs = require('fs');
const path = require('path');

describe('tab bar layout', () => {
  test('uses an explicit opaque native tab bar style', () => {
    const appConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../miniprogram/app.json'), 'utf8')
    );

    expect(appConfig.tabBar).toEqual(
      expect.objectContaining({
        color: '#4b5563',
        selectedColor: '#16a34a',
        backgroundColor: '#ffffff',
        borderStyle: 'black'
      })
    );
  });

  test('tab pages reserve bottom space above the native tab bar', () => {
    const homeStyles = fs.readFileSync(
      path.join(__dirname, '../../miniprogram/pages/home/index.wxss'),
      'utf8'
    );
    const myStyles = fs.readFileSync(
      path.join(__dirname, '../../miniprogram/pages/my/index.wxss'),
      'utf8'
    );

    expect(homeStyles).toContain('padding-bottom: calc(144rpx + env(safe-area-inset-bottom));');
    expect(myStyles).toContain('padding-bottom: calc(144rpx + env(safe-area-inset-bottom));');
  });
});
