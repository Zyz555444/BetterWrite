const fs = require('node:fs');
const path = require('node:path');

const mobileDir = path.dirname(__dirname);
const pkgPath = path.join(mobileDir, 'package.json');
const backupPath = path.join(mobileDir, '.package.json.bak');

if (!fs.existsSync(backupPath)) {
  console.log('No backup found, nothing to restore');
  process.exit(0);
}

fs.copyFileSync(backupPath, pkgPath);
fs.unlinkSync(backupPath);
console.log(`Restored ${pkgPath} from backup`);
