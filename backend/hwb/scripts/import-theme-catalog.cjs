// Explicit administrative import. Never run automatically during deployment/startup.
const catalog = require('../catalog/theme-booklets.json');
const { canonicalCatalogKey, isSpecialStamp, resolveSpecialStamp } = require('../srv/special-stamp-identity');
const apply = process.argv.includes('--apply');
async function main() {
  for (const collection of catalog.collections) {
    if (collection.published && collection.entries.length !== collection.expectedStampCount) throw new Error(`Incomplete mapping: ${collection.code}`);
    if (new Set(collection.entries.map(entry => entry.catalogKey || `regular:${entry.regularNumber}`)).size !== collection.entries.length) throw new Error(`Duplicate member: ${collection.code}`);
  }
  console.log(`${catalog.collections.length} editions; ${catalog.collections.filter(item => item.published).length} complete; ${catalog.specialStamps.length} special stamps.`);
  if (!apply) { console.log('Validation only. To import, provide HWB_BACKEND_URL and HWB_ADMIN_AUTHORIZATION, then --apply.'); return; }
  const base = new URL(process.env.HWB_BACKEND_URL);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('HWB_BACKEND_URL must use HTTP(S)');
  const authorization = process.env.HWB_ADMIN_AUTHORIZATION;
  if (!authorization) throw new Error('HWB_ADMIN_AUTHORIZATION required (Basic or Bearer admin credentials)');
  const api = new URL('/odata/v4/api/', base);
  async function request(path, body) {
    const url = new URL(path, api);
    if (url.origin !== api.origin || !url.pathname.startsWith(api.pathname)) throw new Error('Unexpected API continuation URL');
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { authorization, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Import failed at ${url.pathname}: HTTP ${response.status}`);
    return response.json();
  }
  async function all(path) {
    const rows = [];
    do { const page = await request(path); rows.push(...page.value); path = page['@odata.nextLink']; } while (path);
    return rows;
  }
  const stamps = await all('Stampboxes?$select=ID,number,name,stampType,catalogKey&$top=500&$filter=(validTo%20eq%20null%20or%20validTo%20ne%20null)');
  const editions = await all('ThemeCollections?$top=500');
  const specialByKey = new Map();
  const regularByNumber = new Map();
  for (const stamp of stamps.filter(stamp => !isSpecialStamp(stamp))) {
    if (regularByNumber.has(String(Number(stamp.number)))) throw new Error(`Ambiguous regular stamp number: ${stamp.number}`);
    regularByNumber.set(String(Number(stamp.number)), stamp);
  }
  // Preflight every existing reference before creating anything.
  for (const collection of catalog.collections) for (const entry of collection.entries) {
    if (entry.regularNumber && !regularByNumber.has(entry.regularNumber)) throw new Error(`Missing regular HWN ${entry.regularNumber}`);
  }
  // Resolve the complete catalogue before the first write. Ambiguity is never a
  // reason to mint a second UUID; an operator must reconcile existing duplicates.
  const plan = catalog.specialStamps.map(input => ({ input, existing: resolveSpecialStamp(input, stamps) }));
  for (const { input, existing } of plan) {
    specialByKey.set(canonicalCatalogKey(input.catalogKey), existing || await request('createSpecialStamp', input));
  }
  for (const collection of catalog.collections) {
    const existing = editions.find(item => item.code === collection.code && item.edition === collection.edition);
    if (existing) {
      console.log(`Already imported; kept editorial changes: ${collection.code}`);
      continue;
    }
    const entries = collection.entries.map(entry => ({ stampId: (entry.catalogKey ? specialByKey.get(canonicalCatalogKey(entry.catalogKey)) : regularByNumber.get(entry.regularNumber)).ID, required: entry.required !== false }));
    await request('saveThemeCollection', { ...collection, entries });
    console.log(`Imported ${collection.code}: ${collection.published ? 'complete' : 'editorial draft'}`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
