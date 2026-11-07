function regularStampKey(stamp) {
  if (!stamp || stamp.stampType === 'special' || stamp.catalogKey?.startsWith('special-')) return null;
  const raw = String(stamp.number ?? '').trim();
  const number = Number(raw);
  return /^\d+$/.test(raw) && number >= 1 && number <= 222 ? String(number) : null;
}

function regularStampKeys(stamps) {
  return new Map(stamps.map(stamp => [stamp.ID, regularStampKey(stamp)]).filter(([, key]) => key));
}

function summarizeTourStamps(stamps, poiIds, visits, currentUserId, groupUserIds = []) {
  const keys = regularStampKeys(stamps);
  const tourKeys = new Set(poiIds.map(id => keys.get(id)).filter(Boolean));
  const visitedByUser = new Map();
  for (const visit of visits) {
    const key = keys.get(visit.stamp_ID);
    if (!key) continue;
    if (!visitedByUser.has(visit.createdBy)) visitedByUser.set(visit.createdBy, new Set());
    visitedByUser.get(visit.createdBy).add(key);
  }
  const own = visitedByUser.get(currentUserId) || new Set();
  const group = [...new Set(groupUserIds)];
  const groupTotal = group.reduce((total, userId) => total + [...tourKeys]
    .filter(key => visitedByUser.get(userId)?.has(key)).length, 0);
  return {
    stampCount: tourKeys.size,
    newStampCountForUser: [...tourKeys].filter(key => !own.has(key)).length,
    AverageGroupStampings: group.length ? Math.round(groupTotal / group.length * 100) / 100 : 0,
  };
}

module.exports = { regularStampKey, regularStampKeys, summarizeTourStamps };
