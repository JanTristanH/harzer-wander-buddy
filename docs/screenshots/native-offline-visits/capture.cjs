// Tooling stays outside the app's dependency tree; see README.md beside this script.
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const toolingRequire = process.env.OFFLINE_PREVIEW_TOOLS
  ? createRequire(path.join(process.env.OFFLINE_PREVIEW_TOOLS, 'package.json')) : require;
const { build } = toolingRequire('esbuild');
const { chromium } = toolingRequire('playwright');

(async () => {
  const bundle = await build({
    entryPoints: [path.join(__dirname, 'preview.tsx')], bundle: true, write: false, platform: 'browser',
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    loader: { '.js': 'jsx', '.ttf': 'dataurl', '.jpg': 'dataurl', '.png': 'dataurl' },
    format: 'iife', jsx: 'automatic', define: { 'process.env': '{}', 'process.env.EXPO_OS': '"web"', 'process.env.NODE_ENV': '"production"', __DEV__: 'false' },
    alias: { '@expo/vector-icons': path.join(root, 'app/node_modules/@expo/vector-icons'), 'react-native': path.join(root, 'app/node_modules/react-native-web'),
      react: path.join(root, 'app/node_modules/react'), 'react-dom': path.join(root, 'app/node_modules/react-dom'),
      ...Object.fromEntries(['@/lib/auth', '@/lib/connectivity', '@/lib/offline-visits', '@/lib/offline-notes', 'expo-router'].map((name) => [name, path.join(__dirname, 'preview-services.ts')])),
      '@': path.join(root, 'app') },
    tsconfig: path.join(root, 'app/tsconfig.json'),
  });
  const html = '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}body{background:#faf9f4}</style><div id="root"></div><script src="/preview.js"></script></html>';
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', req.url === '/preview.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/preview.js' ? bundle.outputFiles[0].text : html);
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.on('listening', resolve));
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    page.on('pageerror', (error) => { throw error; });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    await page.getByRole('button', { name: /Synchronisierungsstatus anzeigen/ }).waitFor();
    const badge = await page.getByRole('button', { name: /Synchronisierungsstatus anzeigen/ }).boundingBox();
    const heading = await page.getByText('Stempelstellen', { exact: true }).boundingBox();
    if (!badge || !heading || badge.y + badge.height > heading.y) throw new Error('Status overlaps page heading');
    await page.screenshot({ path: path.join(__dirname, '01-pending-badge.png') });
    await page.getByRole('button', { name: /Synchronisierungsstatus anzeigen/ }).click();
    await page.getByText('Synchronisierungsstatus', { exact: true }).waitFor();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(__dirname, '02-pending-visits.png') });
    await page.goto(`${origin}/?state=failed`);
    await page.getByRole('button', { name: /Synchronisierungsstatus anzeigen/ }).click();
    await page.getByText('Synchronisierungsstatus', { exact: true }).waitFor();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(__dirname, '03-rejected-visit.png') });
    await page.goto(origin);
    await page.getByRole('button', { name: /Synchronisierungsstatus anzeigen/ }).click();
    await page.getByText('Jetzt synchronisieren', { exact: true }).click();
    await page.getByText(/Noch keine Internetverbindung/).waitFor();
    await page.screenshot({ path: path.join(__dirname, '04-offline-retry.png') });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(origin);
    await page.getByRole('button', { name: /Synchronisierungsstatus anzeigen/ }).click();
    await page.waitForTimeout(350);
    for (const label of ['Jetzt synchronisieren', 'Schließen']) {
      const bounds = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      if (!bounds || bounds.y < 0 || bounds.y + bounds.height > 568) throw new Error(`${label} is outside the small viewport`);
    }
    console.log('Saved four screenshots of the production status component.');
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
