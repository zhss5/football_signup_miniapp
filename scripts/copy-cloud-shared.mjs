import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sharedDir = path.join(root, 'cloudfunctions', '_shared');
const functionsDir = path.join(root, 'cloudfunctions');

if (!fs.existsSync(sharedDir) || !fs.existsSync(functionsDir)) {
  process.exit(0);
}

for (const name of fs.readdirSync(functionsDir)) {
  const targetDir = path.join(functionsDir, name);
  if (!fs.statSync(targetDir).isDirectory() || name === '_shared') {
    continue;
  }

  const targetShared = path.join(targetDir, '_shared');
  fs.rmSync(targetShared, { recursive: true, force: true });

  for (const fileName of fs.readdirSync(sharedDir)) {
    const sourceFile = path.join(sharedDir, fileName);

    if (fs.statSync(sourceFile).isFile()) {
      fs.copyFileSync(sourceFile, path.join(targetDir, fileName));
    }
  }
}
