const cds = require('@sap/cds');
const catalogue = require('../catalogue/special-stamps.json');

function catalogRows() {
  return catalogue.stamps.map((stamp) => ({
    ...Object.fromEntries(['ID', 'catalogKey', 'number', 'name', 'description',
      'sourceUrl', 'sourceCheckedAt', 'locationStatus', 'availability', 'identityStatus',
      'latitude', 'longitude'].map((key) => [key, stamp[key]])),
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
    const known = existing.find((stamp) => stamp.catalogKey === row.catalogKey);
    if (known) {
      if (known.stampType === 'special') present++;
      else conflicts.push({ catalogKey: row.catalogKey, name: row.name, existingId: known.ID });
      continue;
    }
    // Never adopt or overwrite legacy/admin entries on the strength of a name.
    const collision = existing.find((stamp) => stamp.ID === row.ID ||
      (row.number !== 'S' && stamp.number === row.number) ||
      stamp.name?.normalize('NFKC').trim().toLocaleLowerCase('de') === row.name.toLocaleLowerCase('de'));
    if (collision) conflicts.push({ catalogKey: row.catalogKey, name: row.name, existingId: collision.ID });
    else missing.push(row);
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
