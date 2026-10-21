#!/usr/bin/env node
// Measure actual exported files, including the entry document's preloads.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const output = resolve(process.argv[2] || 'app/dist-static-website');
const { basePath } = JSON.parse(readFileSync(resolve(output, 'app-build.json'), 'utf8'));
const files = readdirSync(resolve(output, '_expo/static/js/web'), { recursive: true })
  .filter((name) => name.endsWith('.js'))
  .map((name) => resolve(output, '_expo/static/js/web', name));
const measure = (paths) => paths.reduce((sum, path) => {
  const bytes = readFileSync(path);
  sum.raw += bytes.length;
  sum.gzip += gzipSync(bytes).length;
  sum.brotli += brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
  }).length;
  return sum;
}, { raw: 0, gzip: 0, brotli: 0 });

const pages = {};
for (const page of ['index.html', '(tabs)/index.html', 'map.html']) {
  const html = readFileSync(resolve(output, page), 'utf8');
  const initial = new Set();
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const url = match[0].match(/(?:src|href)="([^"]+\.js)"/)?.[1];
    if (!url) continue;
    if (!url.startsWith(`${basePath}/`)) throw new Error(`Unexpected script URL: ${url}`);
    initial.add(resolve(output, url.slice(basePath.length + 1)));
  }
  if (!initial.size) throw new Error(`No initial JavaScript found in ${page}`);
  pages[page] = { ...measure([...initial]), files: [...initial].map((path) => relative(output, path)) };
}
const report = {
  compression: 'Per-file estimates: gzip level 6, Brotli quality 5; hosting must enable compression.',
  total: { ...measure(files), files: files.length },
  pages,
  // The root route redirects to the tabbed list on the client. Count both
  // documents' dependencies, deduplicated, to cover that real entry flow.
  initialList: measure([...new Set([
    ...pages['index.html'].files, ...pages['(tabs)/index.html'].files,
  ])].map((name) => resolve(output, name))),
};
writeFileSync(resolve(output, 'bundle-size.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

// Entry-page budget includes script and preload tags, so moving eager code into
// additional files cannot silently satisfy the budget.
if (process.argv.includes('--check') && report.initialList.raw > 3_500_000) {
  throw new Error('Initial list JavaScript exceeds the 3.5 MB budget');
}
