const fs = require('node:fs');
const path = require('node:path');

const scriptDir = __dirname;
const mobileDir = path.dirname(scriptDir);
const rootDir = path.resolve(mobileDir, '..', '..');
const mobileNodeModules = path.join(mobileDir, 'node_modules');
const pnpmNodeModules = path.join(rootDir, 'node_modules', '.pnpm', 'node_modules');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function linkPackage(sourceDir, targetDir) {
  if (fs.existsSync(targetDir)) {
    const stat = fs.lstatSync(targetDir);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetDir);
    }
  }

  if (process.platform === 'win32') {
    fs.symlinkSync(sourceDir, targetDir, 'junction');
  } else {
    fs.symlinkSync(sourceDir, targetDir, 'dir');
  }
}

function main() {
  if (!fs.existsSync(pnpmNodeModules)) {
    throw new Error(`pnpm virtual store not found: ${pnpmNodeModules}. Run pnpm install first.`);
  }

  ensureDir(mobileNodeModules);

  const pkgJson = require(path.join(mobileDir, 'package.json'));
  const deps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
  };

  for (const name of Object.keys(deps)) {
    let sourceDir;
    if (name.startsWith('@betterwrite/')) {
      const packageName = name.split('/')[1];
      sourceDir = path.join(rootDir, 'packages', packageName);
    } else {
      sourceDir = path.join(pnpmNodeModules, name);
    }

    if (!fs.existsSync(sourceDir)) {
      console.log(`Skipping ${name}: not found at ${sourceDir}`);
      continue;
    }

    if (name.startsWith('@')) {
      const scope = name.split('/')[0];
      const packageName = name.split('/')[1];
      const targetScopeDir = path.join(mobileNodeModules, scope);
      ensureDir(targetScopeDir);
      const targetDir = path.join(targetScopeDir, packageName);
      linkPackage(sourceDir, targetDir);
    } else {
      const targetDir = path.join(mobileNodeModules, name);
      linkPackage(sourceDir, targetDir);
    }
    console.log(`Linked ${name}`);
  }

  console.log('Mobile node_modules symlinks created');
}

main();
