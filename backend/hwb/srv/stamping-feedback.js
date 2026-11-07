const { buildAlbum, stampIdentity } = require('./badge-catalog');

// Both sides are derived from one server snapshot. Repeated visits and special
// stamps therefore cannot inflate regular HWN progress or unlock a badge twice.
function buildStampingFeedback(stamps, visits, requestedIds, overrides = {}) {
  const ids = new Set(requestedIds);
  const confirmed = visits.filter(visit => ids.has(visit.ID));
  const previous = visits.filter(visit => !ids.has(visit.ID));
  const stampById = new Map(stamps.map(stamp => [stamp.ID, stamp]));
  const numbers = rows => new Set(rows.map(visit => stampById.get(visit.stamp_ID))
    .filter(Boolean).map(stampIdentity));
  const before = numbers(previous), after = numbers(visits);
  const regularCount = values => [...values].filter(number =>
    /^\d+$/.test(number) && Number(number) >= 1 && Number(number) <= 222).length;
  const oldAlbum = buildAlbum(stamps, previous, overrides);
  const album = buildAlbum(stamps, visits, overrides);
  const newBadges = album.filter(entry => entry.unlocked &&
    !oldAlbum.find(old => old.id === entry.id)?.unlocked);
  const nextGoal = album.find(entry => !entry.unlocked) ?? null;
  const newPlaces = [...after].filter(number => !before.has(number)).length;
  return {
    visitIds: confirmed.map(visit => visit.ID),
    visitCount: confirmed.length,
    beforeCount: regularCount(before),
    afterCount: regularCount(after),
    newPlaces,
    repeatCount: Math.max(0, confirmed.length - newPlaces),
    places: [...new Set(confirmed.map(visit => stampById.get(visit.stamp_ID)?.name).filter(Boolean))],
    visitedAt: confirmed.map(visit => visit.visitedAt).filter(Boolean).sort().at(-1) ?? null,
    newBadges,
    nextGoal,
  };
}

module.exports = { buildStampingFeedback };
