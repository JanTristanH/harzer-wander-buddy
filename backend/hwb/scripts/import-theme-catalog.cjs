// Explicit administrative import. Never run automatically during deployment/startup.
const catalog = require('../catalog/theme-booklets.json');
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
  const stamps = await all('Stampboxes?$select=ID,number,stampKind,catalogKey&$top=500&$filter=(validTo%20eq%20null%20or%20validTo%20ne%20null)');
  const editions = await all('ThemeCollections?$top=500');
  const specialByKey = new Map(stamps.filter(stamp => stamp.catalogKey).map(stamp => [stamp.catalogKey, stamp]));
  const regularByNumber = new Map();
  for (const stamp of stamps.filter(stamp => stamp.stampKind !== 'special')) {
    if (regularByNumber.has(stamp.number)) throw new Error(`Ambiguous regular stamp number: ${stamp.number}`);
    regularByNumber.set(stamp.number, stamp);
  }
  // Preflight every existing reference before creating anything.
  for (const collection of catalog.collections) for (const entry of collection.entries) {
    if (entry.regularNumber && !regularByNumber.has(entry.regularNumber)) throw new Error(`Missing regular HWN ${entry.regularNumber}`);
  }
  // Reuse the exact historical identities already supported by the badge PR.
  const aliases = {
    'hwn:special:jungborn': ['9901', 'SX-Jungborn', 'Jungborn'],
    'hwn:special:zweilaendereiche': ['9902', 'SX-Zwei-Länder-Eiche', 'Zwei-Länder-Eiche', 'Zweiländereiche'],
    'hwn:special:dreilaenderstein': ['9903', 'SX-Drei-Länder-Stein', 'Drei-Länder-Stein', 'Dreiländerstein'],
  };
  for (const [key, names] of Object.entries(aliases)) {
    if (specialByKey.has(key)) continue;
    const matches = stamps.filter(stamp => names.includes(stamp.number));
    if (matches.length > 1) throw new Error(`Ambiguous legacy special stamp: ${key}`);
    if (matches.length === 1) specialByKey.set(key, matches[0]);
  }
  for (const input of catalog.specialStamps) {
    if (!specialByKey.has(input.catalogKey)) specialByKey.set(input.catalogKey, await request('createSpecialStamp', input));
  }
  for (const collection of catalog.collections) {
    const existing = editions.find(item => item.code === collection.code && item.edition === collection.edition);
    if (existing) {
      console.log(`Already imported; kept editorial changes: ${collection.code}`);
      continue;
    }
    const entries = collection.entries.map(entry => ({ stampId: (entry.catalogKey ? specialByKey.get(entry.catalogKey) : regularByNumber.get(entry.regularNumber)).ID, required: entry.required !== false }));
    await request('saveThemeCollection', { ...collection, entries });
    console.log(`Imported ${collection.code}: ${collection.published ? 'complete' : 'editorial draft'}`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
