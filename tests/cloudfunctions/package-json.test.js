const fs = require('fs');
const path = require('path');

describe('cloud function deployment manifests', () => {
  const functionsRoot = path.join(__dirname, '..', '..', 'cloudfunctions');
  const functionNames = fs
    .readdirSync(functionsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== '_shared')
    .map(entry => entry.name);

  function toKebabCase(value) {
    return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  test.each(functionNames)('%s declares its CloudBase runtime dependencies', functionName => {
    const manifestPath = path.join(functionsRoot, functionName, 'package.json');

    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest).toMatchObject({
      name: `football-signup-${toKebabCase(functionName)}`,
      private: true,
      main: 'index.js'
    });
    expect(manifest.dependencies).toHaveProperty('wx-server-sdk');
  });
});
