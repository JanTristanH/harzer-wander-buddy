// Offline only: rebuild the development CSV from the reviewed, versioned catalog.
const fs = require('node:fs');
const path = require('node:path');
const cds = require('@sap/cds');
const { catalogRows, catalogue } = require('../srv/special-stamp-catalog');
const target = path.join(__dirname, '../db/doNotDeploy-data/hwb.db.Stampboxes.csv');
const [oldColumns, ...data] = cds.parse.csv(fs.readFileSync(target, 'utf8'));
const special = catalogRows();
const columns = [...new Set([...oldColumns, ...Object.keys(special[0])])];
const rows = data.map(row => Object.fromEntries(oldColumns.map((key, i) => [key, row[i] ?? ''])));
const ids = new Set(special.map(row => row.ID));
const regular = rows.filter(row => !ids.has(row.ID));
for (const row of regular) {
  if (!/^\d+$/.test(row.number) || Number(row.number) < 1 || Number(row.number) > 222) continue;
  row.stampType = 'regular';
  row.catalogKey = `hwn-${Number(row.number)}`;
  row.themeKeys = JSON.stringify([...new Set(catalogue.regularMemberships
    .filter(m => m.number === Number(row.number)).map(m => m.themeKey))].sort());
}
const escape = value => /[",\r\n]/.test(String(value ?? ''))
  ? `"${String(value ?? '').replaceAll('"', '""')}"` : String(value ?? '');
fs.writeFileSync(target, [columns, ...[...regular, ...special].map(row => columns.map(key => row[key]))]
  .map(row => row.map(escape).join(',')).join('\n') + '\n');
console.log(`${regular.length} existing rows + ${special.length} special stamps`);

const regularThemes = {};
for (const item of catalogue.regularMemberships) {
  const key = String(item.number);
  regularThemes[key] = [...new Set([...(regularThemes[key] || []), item.themeKey])].sort();
}
const appThemes = path.join(__dirname, '../../..', 'app/lib/regular-stamp-themes.json');
fs.writeFileSync(appThemes, JSON.stringify(regularThemes, null, 2) + '\n');

// The UI's badge filter follows the actual required special identities, not themes or proximity.
const { catalog } = require('../srv/badge-catalog');
const badgeSpecialKeys = [...new Set(catalog.flatMap(badge => badge.required || [])
  .filter(key => typeof key === 'string' && key.startsWith('special-')))].sort();
const { borderAliases } = require('../srv/special-stamp-identity');
const aliases = require('../catalogue/special-stamp-key-aliases.json');
const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const badgeSpecialIdentities = {
  catalogKeys: [...badgeSpecialKeys, ...Object.keys(aliases).filter(key => badgeSpecialKeys.includes(aliases[key]))].sort(),
  legacyNumbers: [...new Set(badgeSpecialKeys.flatMap(key => [key, ...(borderAliases[key] || [])]).map(normalize))].sort(),
};
fs.writeFileSync(path.join(__dirname, '../../..', 'app/lib/badge-special-stamps.json'), JSON.stringify(badgeSpecialIdentities, null, 2) + '\n');
