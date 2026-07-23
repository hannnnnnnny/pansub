const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packageScript = fs.readFileSync(path.join(root, 'scripts', 'package-extension.ps1'), 'utf8');
const popup = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
const options = fs.readFileSync(path.join(root, 'options.html'), 'utf8');
const listing = fs.readFileSync(path.join(root, 'STORE_LISTING.md'), 'utf8');

const releaseFiles = [
  'manifest.json',
  'settings.js',
  'glossary.js',
  'glossary-utils.js',
  'audio-mode-protocol.js',
  'audio-mode-state.js',
  'audio-recognizer.js',
  'audio-translator.js',
  'background.js',
  'content.js',
  'offscreen.html',
  'offscreen.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'options.html',
  'options.css',
  'options.js'
];

for (const file of releaseFiles) {
  assert(fs.existsSync(path.join(root, file)), `release file should exist: ${file}`);
  assert(packageScript.includes(`'${file}'`), `package script should include: ${file}`);
}

assert.strictEqual(manifest.version, packageJson.version, 'manifest and package versions should match');
assert.strictEqual(packageLock.version, manifest.version, 'package-lock root version should match');
assert.strictEqual(packageLock.packages[''].version, manifest.version, 'package-lock package version should match');
assert(popup.includes(`<span class="version">${manifest.version}</span>`), 'popup should show release version');
assert(options.includes(`<span class="version-chip">${manifest.version}</span>`), 'options should show release version');
assert(listing.includes(`dist/pansub-${manifest.version}.zip`), 'store listing should name current package');
assert(Number(manifest.minimum_chrome_version) >= 139, 'Audio Mode requires Chrome 139 or later');
assert(manifest.permissions.includes('offscreen'), 'offscreen permission should be declared');
assert(manifest.permissions.includes('tabCapture'), 'tabCapture permission should be declared');

console.log('Release package audit passed');
