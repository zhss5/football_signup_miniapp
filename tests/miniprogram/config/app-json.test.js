const fs = require('fs');
const path = require('path');

function readAppJson() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../miniprogram/app.json'), 'utf8')
  );
}

describe('mini program app.json config', () => {
  test('keeps user location permission description within WeChat preview limit', () => {
    const appJson = readAppJson();
    const desc = appJson.permission['scope.userLocation'].desc;

    expect(desc.length).toBeLessThanOrEqual(30);
  });
});
