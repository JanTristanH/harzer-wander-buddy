import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { preparePreview } from './prepare-preview.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'hwb-preview-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = resolve(root, 'export');
  mkdirSync(resolve(input, 'assets'), { recursive: true });
  mkdirSync(resolve(input, '_expo'));
  writeFileSync(resolve(input, '_expo/.routes.json'), '{}');
  writeFileSync(resolve(input, 'app-build.json'), JSON.stringify({ dataMode: 'static', revision: 'a'.repeat(40), basePath: '/preview/overview/app' }));
  writeFileSync(resolve(input, 'map.html'), '<html><head></head><body></body></html>');
  writeFileSync(resolve(input, 'assets/icon.ttf'), 'font-bytes');
  writeFileSync(resolve(input, 'entry.js'), 'window.__HWB_STATIC_CATALOGUE__; const font="/preview/overview/app/assets/icon.ttf";');
  const data = { schemaVersion: 1, token: 'DO-NOT-COPY', parkingSpots: [], stamps: Array.from({ length: 222 }, (_, i) => ({
    id: String(i + 1), number: i + 1, name: 'Harz', description: '</script><script>BAD()</script>', latitude: 51.8, longitude: 10.6,
    validFrom: '2020-01-01', validTo: '2099-12-31', articleUrl: `/stempelstelle-${String(i + 1).padStart(3, '0')}-harz/`, userEmail: 'DO-NOT-COPY',
  })) };
  const catalogue = resolve(root, 'catalogue.json');
  const save = () => writeFileSync(catalogue, JSON.stringify(data));
  save();
  return { input, catalogue, data, save, output: resolve(root, 'dist') };
}

test('prepares nested routes, self-contained public data and icon fonts without modifying the export', t => {
  const f = fixture(t);
  const report = preparePreview(f.input, f.catalogue, f.output);
  const destination = resolve(f.output, 'preview/overview/app');
  assert.equal(report.stamps, 222);
  assert.equal(report.inlineFonts, 1);
  const html = readFileSync(resolve(destination, 'map.html'), 'utf8');
  assert.ok(!html.includes('DO-NOT-COPY'));
  assert.ok(!html.includes('</script><script>BAD()'));
  const script = html.match(/<script id="hwb-public-catalogue">([\s\S]*?)<\/script>/)[1];
  const context = { window: {} };
  vm.runInNewContext(script, context);
  assert.equal(context.window.__HWB_STATIC_CATALOGUE__.stamps.length, 222);
  assert.equal(context.window.__HWB_STATIC_CATALOGUE__.stamps[0].description, f.data.stamps[0].description);
  assert.match(readFileSync(resolve(destination, 'entry.js'), 'utf8'), /data:font\/ttf;base64,/);
  assert.match(readFileSync(resolve(f.input, 'entry.js'), 'utf8'), /\/assets\/icon.ttf/);
  assert.match(readFileSync(resolve(f.output, 'index.html'), 'utf8'), /url=\/preview\/overview\/app\/map/);
  assert.equal(readFileSync(resolve(destination, '_expo/.routes.json'), 'utf8'), '{}');
  assert.throws(() => preparePreview(f.input, f.catalogue, f.output), /already exists/);
});

test('rejects incomplete, duplicate or geographically invalid catalogues', t => {
  const f = fixture(t);
  f.data.stamps.pop(); f.save();
  assert.throws(() => preparePreview(f.input, f.catalogue, f.output), /222/);
  f.data.stamps.push({ ...f.data.stamps[0] }); f.save();
  assert.throws(() => preparePreview(f.input, f.catalogue, f.output), /222/);
  f.data.stamps[221] = { ...f.data.stamps[0], id: '222', number: 222, latitude: 120 }; f.save();
  assert.throws(() => preparePreview(f.input, f.catalogue, f.output), /coordinates/);
});

test('rejects an old bundle and unsafe base paths before packaging', t => {
  const f = fixture(t);
  writeFileSync(resolve(f.input, 'entry.js'), 'old app without embedded data support');
  assert.throws(() => preparePreview(f.input, f.catalogue, f.output), /Rebuild/);
  writeFileSync(resolve(f.input, 'app-build.json'), JSON.stringify({ dataMode: 'static', revision: 'a'.repeat(40), basePath: '/../other' }));
  assert.throws(() => preparePreview(f.input, f.catalogue, f.output), /Invalid static/);
});
