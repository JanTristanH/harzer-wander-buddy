// Explicit preview fixture setup only. Never called by the production service.
const { randomUUID } = require('node:crypto');
const { buildAlbum, sanitizeSelection } = require('../srv/badge-catalog');

function buildDemoBadgeData(stamps, users, existingVisits = []) {
  const regular = stamps
    .filter(
      (stamp) =>
        /^\d+$/.test(String(stamp.number)) &&
        Number(stamp.number) >= 1 &&
        Number(stamp.number) <= 222
    )
    .sort((a, b) => Number(a.number) - Number(b.number));
  const regularIds = new Set(regular.map((stamp) => stamp.ID));
  const visits = [];
  const profiles = users.map(({ id, targetCount }) => {
    const previous = existingVisits.filter((visit) => visit.createdBy === id);
    const visited = new Set(
      previous.map((visit) => visit.stamp_ID).filter((id) => regularIds.has(id))
    );
    const added = [];
    for (const stamp of regular) {
      if (visited.size >= targetCount) break;
      if (visited.has(stamp.ID)) continue;
      visited.add(stamp.ID);
      added.push({
        ID: randomUUID(),
        stamp_ID: stamp.ID,
        createdBy: id,
        visitedAt: '2026-10-01T10:00:00.000Z',
        createdAt: '2026-10-01T10:00:00.000Z',
      });
    }
    visits.push(...added);
    const album = buildAlbum(stamps, [...previous, ...added]);
    const unlocked = ['emperor', 'king', 'gold', 'silver', 'bronze']
      .map((id) => album.find((entry) => entry.id === id))
      .filter((entry) => entry?.unlocked);
    const selection = sanitizeSelection(
      {
        featured: unlocked.slice(0, 3).map((entry) => entry.id),
        frame: unlocked[0]?.id || '',
        title: unlocked[0]?.titles[0]?.id || 'wanderer',
      },
      album
    );
    return {
      userId: id,
      featured: JSON.stringify(selection.featured),
      frame: selection.frame,
      title: selection.title,
      selectionChanged: false,
    };
  });
  return { visits, profiles };
}

async function seed() {
  const cds = require('@sap/cds');
  if (cds.env.profiles.includes('production') || !cds.env.profiles.includes('dev-basic'))
    throw new Error('Demo badges require the explicit dev-basic preview profile');
  cds.model = await cds.load('db/schema.cds');
  const db = await cds.connect.to('db');
  const { SELECT, INSERT, UPSERT } = cds.ql;
  const entities = cds.entities('hwb.db');
  const configuredAccounts = Object.keys(
    require('../package.json').cds.requires.auth['[dev-basic]'].users
  ).filter((id) => /@hwb\.de$/.test(id));
  await db.tx(async (tx) => {
    const external = await tx.run(SELECT.from(entities.ExternalUsers));
    const accounts = [
      ...new Set([
        ...configuredAccounts,
        ...external
          .map((user) => user.email)
          .filter((email) => /^user[0-9]+@hwb\.de$/.test(email || '')),
      ]),
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const users = [];
    for (const [index, email] of accounts.entries()) {
      if (!external.some((user) => user.ID === email)) {
        await tx.run(
          INSERT.into(entities.ExternalUsers).entries({
            ID: email,
            email,
            name: `Wanderbuddy ${index + 1}`,
            onboardingCompleted: true,
          })
        );
      }
      const ids = new Set([
        email,
        ...external.filter((user) => user.email === email).map((user) => user.ID),
      ]);
      for (const id of ids) users.push({ id, targetCount: [8, 16, 24, 50][index % 4] });
    }
    const stamps = await tx.run(SELECT.from(entities.Stampboxes).columns('ID', 'number', 'name'));
    const previous = await tx.run(
      SELECT.from(entities.Stampings).where({ createdBy: { in: users.map((user) => user.id) } })
    );
    const data = buildDemoBadgeData(stamps, users, previous);
    if (data.visits.length) await tx.run(INSERT.into(entities.Stampings).entries(data.visits));
    if (data.profiles.length)
      await tx.run(UPSERT.into(entities.BadgeProfiles).entries(data.profiles));
  });
  await db.disconnect();
}
module.exports = { buildDemoBadgeData };
if (require.main === module)
  seed().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
