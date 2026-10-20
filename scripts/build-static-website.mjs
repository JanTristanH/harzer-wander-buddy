#!/usr/bin/env node
// Build the actual Expo router tree, never a separate copy of the UI.
import { spawnSync, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = resolve(root, 'app');
const output = resolve(process.argv[2] || resolve(app, 'dist-static-website'));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const basePath = process.env.EXPO_PUBLIC_STATIC_BASE_PATH || '/preview/overview/app';
if (!/^\/[a-zA-Z0-9/_-]+$/.test(basePath) || basePath.endsWith('/')) {
  throw new Error('EXPO_PUBLIC_STATIC_BASE_PATH must be an absolute path without a trailing slash');
}
const result = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', output], {
  cwd: app,
  stdio: 'inherit',
  env: { ...process.env, CI: '1', EXPO_PUBLIC_DATA_MODE: 'static', EXPO_PUBLIC_AUTH_MODE: 'sso',
    EXPO_PUBLIC_STATIC_BASE_PATH: basePath, EXPO_PUBLIC_STATIC_REVISION: revision },
});
if (result.status !== 0) process.exit(result.status || 1);
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'app-build.json'), JSON.stringify({
  repository: 'JanTristanH/harzer-wander-buddy', revision, basePath, dataMode: 'static',
  ui: 'app/app/(tabs)/index.tsx + app/app/(tabs)/map.tsx',
}, null, 2) + '\n');
