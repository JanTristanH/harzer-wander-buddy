// Manual live smoke test: one bounded pack, real downloader, local filesystem IO.
// Never run as an ordinary CI test against the public tile provider.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const ts = require('../app/node_modules/typescript');
const run = promisify(execFile);

async function main() {
  if (!process.argv.includes('--confirm-provider-download')) {
    throw new Error('Explicit --confirm-provider-download required: downloads one real 10 × 10 km pack.');
  }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hwb-offline-map-check-'));
  for (const name of ['offline-maps', 'offline-map-style']) {
    const source = await fs.readFile(path.join(__dirname, '../app/lib', `${name}.ts`), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    await fs.writeFile(path.join(directory, `${name}.js`), compiled);
  }
  const maps = require(path.join(directory, 'offline-maps.js'));
  const { offlineMapStyle } = require(path.join(directory, 'offline-map-style.js'));
  const bounds = maps.boundsAround(51.789, 10.635);
  const packDirectory = path.join(directory, 'pack');
  let written = 0, lastProgress;
  const result = await maps.downloadOfflineMap(bounds, {
    read: async (url, remainingBytes, signal) => {
      const { stdout } = await run('curl', [
        '--fail', '--silent', '--show-error', '--compressed', '--location', '--max-redirs', '0',
        '--max-time', '30', '--max-filesize', String(remainingBytes),
        '--user-agent', maps.OFFLINE_MAP_USER_AGENT, url,
      ], { encoding: 'buffer', maxBuffer: remainingBytes + 1, signal });
      return new Uint8Array(stdout);
    },
    write: async (relativePath, data) => {
      const target = path.join(packDirectory, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data);
      written++;
    },
  }, new AbortController().signal, progress => {
    lastProgress = progress;
    if (progress.completed % 20 === 0) console.log(`Downloaded ${progress.completed}/${progress.total}`);
  });
  assert.equal(lastProgress.completed, lastProgress.total);
  assert.equal(written, result.tileCount + 5);
  assert.ok(result.bytes < maps.OFFLINE_MAP_MAX_BYTES);
  const pack = { id: 'live-smoke', name: 'Brocken & Schierke', bounds, ...result, createdAt: new Date().toISOString() };
  const style = offlineMapStyle(pack, pathToFileURL(packDirectory).href);
  assert.ok(!/https?:/.test(JSON.stringify(style)));
  await fs.writeFile(path.join(packDirectory, 'complete.json'), JSON.stringify(pack, null, 2));
  await fs.writeFile(path.join(packDirectory, 'style.json'), JSON.stringify(style, null, 2));
  console.log(JSON.stringify({ ...result, resourcesWritten: written, packDirectory, localStyleOnly: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
