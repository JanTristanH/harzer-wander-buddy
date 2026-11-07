const cds = require('@sap/cds');
const catalogue = require('../catalogue/special-stamps.json');
const { resolveSpecialStamp } = require('./special-stamp-identity');

function catalogRows() {
  return catalogue.stamps.map((stamp) => ({
    ...Object.fromEntries(['ID', 'catalogKey', 'number', 'name', 'description',
      'sourceUrl', 'sourceCheckedAt', 'locationStatus', 'availability', 'identityStatus',
      'latitude', 'longitude', 'heroImageUrl', 'imageCaption'].map((key) => [key, stamp[key]])),
    stampType: 'special',
    themeKeys: JSON.stringify(stamp.themeKeys),
    orderBy: `S-${(stamp.number === 'S' ? stamp.name : stamp.number).slice(0, 38)}`,
    validFrom: '1970-01-01T00:00:00.000Z',
    validTo: '9999-12-31T23:59:59.000Z',
  }));
}

function planInitialization(existing) {
  const missing = [], conflicts = [];
  let present = 0;
  for (const row of catalogRows()) {
    try {
      if (resolveSpecialStamp(row, existing)) present++;
      else missing.push(row);
    } catch (error) {
      conflicts.push({ catalogKey: row.catalogKey, name: row.name, reason: error.message });
    }
  }
  return { missing, conflicts, existing: present };
}

function register(service) {
  service.on('initializeSpecialStamps', async (req) => {
    const { Stampboxes, NoticeSyncState } = cds.entities('hwb.db');
    const preview = req.data.preview !== false;
    if (!preview) {
      const lock = await SELECT.one.from(NoticeSyncState)
        .where({ ID: 'special-catalog' }).forUpdate();
      if (!lock) return req.reject(503, 'Bitte zuerst die Datenbankmigration ausführen.');
    }
    const existing = await SELECT.from(Stampboxes).columns('ID', 'number', 'name', 'catalogKey', 'stampType');
    const plan = planInitialization(existing);
    if (!preview && plan.missing.length) await INSERT.into(Stampboxes).entries(plan.missing);
    return JSON.stringify({
      preview,
      checkedAt: catalogue.checkedAt,
      total: catalogue.stamps.length,
      existing: plan.existing,
      created: preview ? 0 : plan.missing.length,
      pending: preview ? plan.missing.length : 0,
      conflicts: plan.conflicts,
      withoutCoordinates: catalogue.stamps.filter((stamp) => stamp.locationStatus !== 'verified').length,
    });
  });
}

module.exports = { catalogue, catalogRows, planInitialization, register };
