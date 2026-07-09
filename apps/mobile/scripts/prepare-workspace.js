const fs = require('node:fs');
const path = require('node:path');

const scriptDir = __dirname;
const mobileDir = path.dirname(scriptDir);
const rootDir = path.resolve(mobileDir, '..', '..');

console.log(`Script dir: ${scriptDir}`);
console.log(`Mobile dir: ${mobileDir}`);
console.log(`Root dir: ${rootDir}`);

const packagesToLink = [
  { name: '@betterwrite/tsconfig', src: 'tsconfig' },
  { name: '@betterwrite/shared', src: 'shared' },
  { name: '@betterwrite/design-system', src: 'design-system' },
];

function setupWorkspacePackage(pkg) {
  const srcDir = path.join(rootDir, 'packages', pkg.src);
  const destDir = path.join(mobileDir, 'node_modules', pkg.name);

  console.log(`Processing ${pkg.name}: ${srcDir} -> ${destDir}`);

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(path.dirname(destDir))) {
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
  }

  const srcPackageJsonPath = path.join(srcDir, 'package.json');
  if (!fs.existsSync(srcPackageJsonPath)) {
    throw new Error(`Package.json not found: ${srcPackageJsonPath}`);
  }

  const srcPackageJson = require(srcPackageJsonPath);

  const pkgInfo = {
    ...srcPackageJson,
    main: './dist/index.js',
    types: './dist/index.d.ts',
  };

  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, 'package.json'), JSON.stringify(pkgInfo, null, 2));

  const distDir = path.join(srcDir, 'dist');
  if (fs.existsSync(distDir)) {
    fs.cpSync(distDir, path.join(destDir, 'dist'), { recursive: true });
    console.log(`Copied dist from ${distDir}`);
  } else {
    console.log(`Warning: dist directory not found at ${distDir}`);
  }

  console.log(`Linked ${pkg.name} -> ${destDir}`);
}

packagesToLink.forEach(setupWorkspacePackage);
console.log('Workspace packages prepared for EAS build');
