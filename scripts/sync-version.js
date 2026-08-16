/* Keeps the installer's version number in step with the build marker in index.html.
 *
 * Without this, package.json stays at 4.0.0 forever while the marker climbs (g117, g118...), so
 * every installer is called "StudioFlow Setup 4.0.0.exe", Windows treats them all as the same
 * version, and the Apps list never tells you which build is actually installed. Upgrading becomes
 * guesswork.
 *
 * Runs automatically before `npm run dist` via the "predist" script — there is nothing to remember.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname.endsWith('scripts') ? path.join(__dirname, '..') : __dirname;
const indexPath = path.join(root, 'index.html');
const pkgPath = path.join(root, 'package.json');

const html = fs.readFileSync(indexPath, 'utf8');
const marker = html.match(/StudioFlow\s+([0-9]+\.[0-9]+)\s*·\s*build\s+g([0-9]+)/i);

if (!marker) {
  console.error('Could not find the build marker in index.html — leaving the version alone.');
  console.error('Expected something like: StudioFlow 4.0 \u00b7 build g117');
  process.exit(0);                       // never block a build over this
}

const [, series, build] = marker;
const version = `${series}.${build}`;    // 4.0 + g117 -> 4.0.117

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.version === version) {
  console.log(`Version already ${version} — nothing to do.`);
  process.exit(0);
}

const was = pkg.version;
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`Installer version ${was} -> ${version} (from build g${build}).`);
