/**
 * Fix Electron sandbox permissions on Linux
 * chrome-sandbox must be owned by root with mode 4755
 *
 * Note: requires sudo; intended for CI or manual runs only
 * Usage: sudo npm run fix-sandbox
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform === 'linux') {
  const sandboxPath = path.resolve(__dirname, '../node_modules/electron/dist/chrome-sandbox');
  if (fs.existsSync(sandboxPath)) {
    execSync(`sudo chown root:root ${sandboxPath}`);
    execSync(`sudo chmod 4755 ${sandboxPath}`);
    console.log('[fix-sandbox] chrome-sandbox permissions fixed');
  } else {
    console.log('[fix-sandbox] chrome-sandbox not found, skipping');
  }
}
