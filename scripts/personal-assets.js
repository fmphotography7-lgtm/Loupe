#!/usr/bin/env node
/* StudioFlow — PERSONAL ASSETS, IN AND OUT OF THE BUILD.
   =====================================================================================
   Kirk licensed Black Crush for his own price cards. He was clear about what that means:
   "i only want the price list for me and not for distribution if we do market this product."

   Everything under assets/fonts/personal/ is HIS, not StudioFlow's. package.json includes the
   whole assets tree in the installer, so this script is what keeps that promise: `hide` moves the
   folder to _personal-assets-out/ (outside the build's file list), `restore` puts it back.
   BUILD_FOR_DISTRIBUTION.bat does hide → build → restore.

   MOVED, NEVER DELETED. A build script that removes a file he paid for is one crash away
   from losing it. The folder is only ever renamed, and restore is run even if the build fails.

   `check` is what predist calls: it does not block anything, it just SAYS OUT LOUD whether a
   personal asset is about to be packaged. Shipping his font by accident should be impossible
   to do quietly.
   ===================================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIVE = path.join(ROOT, 'assets', 'fonts', 'personal');
const PARKED = path.join(ROOT, '_personal-assets-out', 'fonts-personal');

const list = dir => { try { return fs.readdirSync(dir).filter(f => !/^\./.test(f)); } catch (_) { return []; } };

function move(from, to, label) {
  if (!fs.existsSync(from)) { console.log(`  nothing to ${label} — ${path.relative(ROOT, from)} is not there`); return false; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) {
    /* Both present means a previous run was interrupted. Keep BOTH rather than overwrite. */
    const spare = `${to}-${Date.now()}`;
    fs.renameSync(to, spare);
    console.log(`  a parked copy was already there; kept it as ${path.relative(ROOT, spare)}`);
  }
  fs.renameSync(from, to);
  console.log(`  ${label}: ${path.relative(ROOT, from)} -> ${path.relative(ROOT, to)}`);
  return true;
}

const cmd = (process.argv[2] || 'check').toLowerCase();

if (cmd === 'hide') {
  console.log('Taking your personal assets out of this build:');
  move(LIVE, PARKED, 'moved out');
  console.log('  The Canada Day price cards will use Archivo Black in this build, which is');
  console.log('  bundled under the Open Font Licence and free to pass on.');
} else if (cmd === 'restore') {
  console.log('Putting your personal assets back:');
  move(PARKED, LIVE, 'restored');
} else {
  const files = list(LIVE);
  if (files.length) {
    console.log('');
    console.log('  NOTE: this build will INCLUDE your own personal, non-redistributable assets:');
    files.forEach(f => console.log(`        assets/fonts/personal/${f}`));
    console.log('  That is right for a build you use yourself.');
    console.log('  To build a copy for anyone else, run BUILD_FOR_DISTRIBUTION.bat instead.');
    console.log('');
  }
}
