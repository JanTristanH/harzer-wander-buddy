// Explicit compatibility table; never infer a catalogue identity from a fuzzy name.
const aliases = require('../catalogue/special-stamp-key-aliases.json');
const catalog = require('../catalogue/special-stamps.json');
const borderAliases = {
  'special-jungborn': ['9901', 'SX-Jungborn', 'Jungborn'],
  'special-two-countries-oak': ['9902', 'SX-Zwei-Länder-Eiche', 'Zwei-Länder-Eiche', 'Zweiländereiche', 'Zweilaendereiche', 'SX-Zweilaendereiche'],
  'special-three-countries-stone': ['9903', 'SX-Drei-Länder-Stein', 'Drei-Länder-Stein', 'Dreiländerstein'],
};

function canonicalCatalogKey(key) { return aliases[key] || key || null; }
function legacyBorderKey(stamp) {
  if (stamp.catalogKey) return null;
  const normalized = value => String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  return Object.keys(borderAliases).find(key => [key, ...borderAliases[key]]
    .some(alias => normalized(alias) === normalized(stamp.number))) || null;
}
function isSpecialStamp(stamp) {
  return stamp.stampType === 'special' || stamp.stampKind === 'special' ||
    /^(special-|hwn:special:)/.test(stamp.catalogKey || '') || !/^\d+$/.test(String(stamp.number ?? '').trim()) ||
    Number(stamp.number) < 1 || Number(stamp.number) > 222;
}

// Returns the existing row unchanged, including IDs used by visits/notes/links.
// Conflicting canonical, alias, historical, or reserved UUID identities fail closed.
function resolveSpecialStamp(input, existing) {
  const key = canonicalCatalogKey(input.catalogKey);
  const definition = catalog.stamps.find(stamp => stamp.catalogKey === key);
  const matches = existing.filter(stamp => canonicalCatalogKey(stamp.catalogKey) === key ||
    legacyBorderKey(stamp) === key || (definition && stamp.ID === definition.ID));
  if (matches.length > 1) throw new Error(`Ambiguous special stamp identity: ${key}`);
  const match = matches[0];
  if (match && ((!isSpecialStamp(match)) || (match.stampType === 'regular' && match.catalogKey === key) ||
      (match.catalogKey && canonicalCatalogKey(match.catalogKey) !== key))) {
    throw new Error(`Conflicting special stamp identity: ${key}`);
  }
  if (match) return match;
  const name = (definition?.name || input.name || '').normalize('NFKC').trim().toLocaleLowerCase('de');
  if (existing.some(stamp => (input.number !== 'S' && stamp.number === input.number) ||
      (definition?.number !== 'S' && definition?.number && stamp.number === definition.number) ||
      stamp.name?.normalize('NFKC').trim().toLocaleLowerCase('de') === name)) {
    throw new Error(`Unresolved special stamp collision: ${key}`);
  }
  return null;
}

module.exports = { borderAliases, canonicalCatalogKey, legacyBorderKey, isSpecialStamp, resolveSpecialStamp };
