import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(run) {
  const output = mkdtempSync(resolve(tmpdir(), 'web-bundle-test-'));
  try {
    mkdirSync(resolve(output, '_expo/static/js/web'), { recursive: true });
    mkdirSync(resolve(output, '(tabs)'));
    writeFileSync(resolve(output, 'app-build.json'), JSON.stringify({ basePath: '/app' }));
    for (const name of ['entry', 'shared', 'list', 'map']) {
      writeFileSync(resolve(output, `_expo/static/js/web/${name}.js`), 'x'.repeat(100));
    }
    const script = (name) => `<script src="/app/_expo/static/js/web/${name}.js"></script>`;
    const preload = '<link rel="preload" href="/app/_expo/static/js/web/shared.js" as="script">';
    writeFileSync(resolve(output, 'index.html'), script('entry') + preload + script('shared'));
    writeFileSync(resolve(output, '(tabs)/index.html'), script('entry') + preload + script('list'));
    writeFileSync(resolve(output, 'map.html'), script('entry') + preload + script('map'));
    run(output);
  } finally { rmSync(output, { recursive: true, force: true }); }
}

const measure = (output) => spawnSync(process.execPath, [
  resolve(import.meta.dirname, '../measure-web-bundle.mjs'), output, '--check',
], { encoding: 'utf8' });

test('counts preloads and redirected list dependencies once, and reports all exported JavaScript', () => {
  fixture((output) => {
    const result = measure(output);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(readFileSync(resolve(output, 'bundle-size.json'), 'utf8'));
    assert.equal(report.pages['index.html'].raw, 200);
    assert.equal(report.initialList.raw, 300);
    assert.equal(report.total.raw, 400);
    assert.ok(report.initialList.gzip > 0);
  });
});

test('fails the budget when an oversized dependency is preloaded', () => {
  fixture((output) => {
    writeFileSync(resolve(output, '_expo/static/js/web/shared.js'), 'x'.repeat(3_500_000));
    const result = measure(output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exceeds the 3.5 MB budget/);
  });
});
