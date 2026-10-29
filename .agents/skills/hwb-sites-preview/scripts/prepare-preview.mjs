#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const stampFields = ['id', 'number', 'name', 'description', 'latitude', 'longitude', 'validFrom', 'validTo', 'articleUrl', 'heroImageUrl', 'imageCaption'];
const parkingFields = ['ID', 'name', 'description', 'latitude', 'longitude'];
const pick = (object, keys) => Object.fromEntries(keys.filter(key => key in object).map(key => [key, object[key]]));

function publicCatalogue(input) {
  if (input.schemaVersion !== 1 || !Array.isArray(input.stamps) || !Array.isArray(input.parkingSpots)) throw new Error('Invalid catalogue schema');
  if (input.stamps.length !== 222 || new Set(input.stamps.map(stamp => stamp.id)).size !== 222
    || new Set(input.stamps.map(stamp => stamp.number)).size !== 222
    || input.stamps.some(stamp => !Number.isInteger(stamp.number) || stamp.number < 1 || stamp.number > 222 || typeof stamp.id !== 'string' || !stamp.id)) {
    throw new Error('Expected all 222 unique regular stamps (numbers 1–222)');
  }
  for (const item of [...input.stamps, ...input.parkingSpots]) {
    if (!Number.isFinite(item.latitude) || Math.abs(item.latitude) > 90 || !Number.isFinite(item.longitude) || Math.abs(item.longitude) > 180) throw new Error('Invalid catalogue coordinates');
  }
  for (const stamp of input.stamps) {
    if (typeof stamp.name !== 'string' || typeof stamp.description !== 'string'
      || !Number.isFinite(Date.parse(stamp.validFrom)) || !Number.isFinite(Date.parse(stamp.validTo))
      || !/^\/stempelstelle-\d{3}-[^/]+\/$/.test(stamp.articleUrl)) throw new Error('Invalid public stamp fields');
  }
  return { schemaVersion: 1, stamps: input.stamps.map(stamp => pick(stamp, stampFields)), parkingSpots: input.parkingSpots.map(spot => pick(spot, parkingFields)) };
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink() || (entry.name.startsWith('.') && entry.name !== '.routes.json')) {
      throw new Error('Expected only generated export files, without symlinks or private hidden files');
    }
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

export function preparePreview(exportDirectory, cataloguePath, outputDirectory) {
  const input = resolve(exportDirectory);
  const output = resolve(outputDirectory);
  if (!relative(input, output).startsWith('..')) throw new Error('Output must be outside the input export');
  if (existsSync(output)) throw new Error('Output already exists; use a new dist directory and preserve Site identity');
  const build = JSON.parse(readFileSync(resolve(input, 'app-build.json'), 'utf8'));
  if (build.dataMode !== 'static' || !/^\/[a-zA-Z0-9/_-]+$/.test(build.basePath) || build.basePath.endsWith('/')
    || !/^[a-f0-9]{40}$/.test(build.revision)) throw new Error('Invalid static app-build.json');
  const catalogue = publicCatalogue(JSON.parse(readFileSync(resolve(cataloguePath), 'utf8')));
  const paths = files(input);
  const jsFiles = paths.filter(path => path.endsWith('.js'));
  if (!jsFiles.some(path => readFileSync(path, 'utf8').includes('__HWB_STATIC_CATALOGUE__'))) {
    throw new Error('Rebuild with the embedded-catalogue adapter before packaging');
  }
  const fonts = paths.filter(path => /\.(ttf|woff2?)$/.test(path)).map(path => {
    const type = path.endsWith('.ttf') ? 'ttf' : path.endsWith('.woff2') ? 'woff2' : 'woff';
    return [`${build.basePath}/${relative(input, path).split('\\').join('/')}`, `data:font/${type};base64,${readFileSync(path).toString('base64')}`];
  });
  if (!fonts.length) throw new Error('Missing exported icon fonts');
  const htmlFiles = paths.filter(path => path.endsWith('.html'));
  if (!htmlFiles.length || htmlFiles.some(path => !/<head\b[^>]*>/i.test(readFileSync(path, 'utf8')))) throw new Error('Missing HTML document heads');
  if (!existsSync(resolve(input, 'map.html'))) throw new Error('Missing exported map route');
  // Validate everything before creating the destination. Only public data is embedded.
  const bootstrap = `<script id="hwb-public-catalogue">window.__HWB_STATIC_CATALOGUE__=${JSON.stringify(catalogue).replaceAll('<', '\\u003c')};</script>`;
  const destination = resolve(output, `.${build.basePath}`);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(input, destination, { recursive: true });
  for (const path of paths.filter(path => /\.(html|js|css)$/.test(path))) {
    let text = readFileSync(path, 'utf8');
    for (const [url, data] of fonts) text = text.replaceAll(url, data);
    if (path.endsWith('.html')) text = text.replace(/<head\b[^>]*>/i, head => `${head}${bootstrap}`);
    writeFileSync(resolve(destination, relative(input, path)), text);
  }
  writeFileSync(resolve(destination, 'public-catalogue.json'), JSON.stringify(catalogue));
  const route = `${build.basePath}/map`;
  writeFileSync(resolve(output, 'index.html'), `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Harzer Wander Buddy – Vorschau</title><meta http-equiv="refresh" content="0;url=${route}"></head><body><a href="${route}">Karten-Vorschau öffnen</a></body></html>`);
  const report = { revision: build.revision, basePath: build.basePath, stamps: catalogue.stamps.length, inlineFonts: fonts.length };
  writeFileSync(resolve(output, 'preview-build.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 5) throw new Error('Usage: node prepare-preview.mjs <expo-export> <public-catalogue.json> <new-dist-directory>');
  console.log(JSON.stringify(preparePreview(...process.argv.slice(2)), null, 2));
}
