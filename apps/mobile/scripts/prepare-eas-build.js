const fs = require('node:fs');
const path = require('node:path');

const mobileDir = path.dirname(__dirname);
const pkgPath = path.join(mobileDir, 'package.json');
const originalPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const backupPath = path.join(mobileDir, '.package.json.bak');

if (fs.existsSync(backupPath)) {
  console.log('Backup already exists, restoring first...');
  fs.copyFileSync(backupPath, pkgPath);
}

fs.writeFileSync(backupPath, `${JSON.stringify(originalPkg, null, 2)}\n`);

const rewriteDeps = (deps) => {
  if (!deps) return deps;
  const out = {};
  for (const [name, value] of Object.entries(deps)) {
    if (value === 'workspace:*' && name.startsWith('@betterwrite/')) {
      const pkgName = name.replace('@betterwrite/', '');
      out[name] = `file:../../packages/${pkgName}`;
      console.log(`Rewriting ${name}: ${value} -> file:../../packages/${pkgName}`);
    } else {
      out[name] = value;
    }
  }
  return out;
};

const newPkg = {
  ...originalPkg,
  dependencies: rewriteDeps(originalPkg.dependencies),
  devDependencies: rewriteDeps(originalPkg.devDependencies),
};

fs.writeFileSync(pkgPath, `${JSON.stringify(newPkg, null, 2)}\n`);
console.log(`Rewrote ${pkgPath} for EAS build (backup: ${backupPath})`);
