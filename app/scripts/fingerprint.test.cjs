/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFingerprintAsync, diffFingerprints } = require('expo/fingerprint');

test('release versions preserve the runtime while native configuration changes it', async t => {
  const appRoot = path.resolve(__dirname, '..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hwb-fingerprint-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ['app.json', 'app.config.ts', 'package.json', 'fingerprint.config.js']) {
    fs.copyFileSync(path.join(appRoot, name), path.join(root, name));
  }
  fs.cpSync(path.join(appRoot, 'assets'), path.join(root, 'assets'), { recursive: true });
  fs.symlinkSync(path.join(appRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const write = (name, data) => fs.writeFileSync(path.join(root, name), JSON.stringify(data));
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const fingerprint = () => createFingerprintAsync(root, { silent: true });

  const before = await fingerprint();
  assert.ok(before.sources.some(source => source.id === 'expoConfig'));
  pkg.version = '99.0.0';
  write('package.json', pkg);
  config.expo.android.versionCode = 999;
  config.expo.ios.buildNumber = '999';
  write('app.json', config);
  const afterRelease = await fingerprint();
  assert.equal(afterRelease.hash, before.hash, JSON.stringify(diffFingerprints(before, afterRelease)));

  config.expo.android.permissions.push('android.permission.CAMERA');
  config.expo.ios.infoPlist.NSCameraUsageDescription = 'Fingerprint regression test';
  write('app.json', config);
  const afterNativeChange = await fingerprint();
  assert.notEqual(afterNativeChange.hash, before.hash);
});
