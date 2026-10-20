// Pure route search: the service loads data and enriches the selected routes.
const MAX_SEARCH_STATES = 100000;

function compareRoutes(a, b) {
  return b.matchingStampCount - a.matchingStampCount
    || a.duration - b.duration
    || a.distance - b.distance
    || a.id.localeCompare(b.id);
}

function selectRoutes(routes, limit = 5) {
  const seen = new Set();
  return [...routes].sort(compareRoutes).filter(route => {
    const key = route.stampIds.slice().sort().join(';');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function findRoutes(params, edges, stampings, groupUserIds, currentUserId) {
  const stampedBy = new Map();
  for (const stamping of stampings) {
    if (!stampedBy.has(stamping.stamp_ID)) stampedBy.set(stamping.stamp_ID, new Set());
    stampedBy.get(stamping.stamp_ID).add(stamping.createdBy);
  }
  const isMatching = id => params.groupMode === 'missing_all'
    ? groupUserIds.every(userId => !stampedBy.get(id)?.has(userId))
    : groupUserIds.some(userId => !stampedBy.get(id)?.has(userId));

  const adjacent = new Map();
  for (const edge of edges) {
    const duration = Number(edge.durationSeconds);
    const distance = Number(edge.distanceMeters);
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(distance) || distance < 0) continue;
    if (!['walk', 'drive'].includes(edge.travelMode)) continue;
    if (!adjacent.has(edge.fromPoi)) adjacent.set(edge.fromPoi, []);
    adjacent.get(edge.fromPoi).push(edge);
  }
  // Stable traversal makes ties and the bounded search reproducible.
  for (const neighbors of adjacent.values()) neighbors.sort((a, b) => String(a.ID).localeCompare(String(b.ID)));

  let states = 0;
  let searchLimited = false;
  const routes = [];
  const usedEdges = new Set();
  function visit(poi, car, path, duration, distance, stampIds) {
    if (++states > MAX_SEARCH_STATES) { searchLimited = true; return; }
    if (path.length && poi === car && stampIds.size) {
      const ids = [...stampIds];
      const matchingStampCount = ids.filter(isMatching).length;
      if (matchingStampCount >= params.minStampCount) {
        routes.push({
          id: path.map(edge => edge.ID).join(';'),
          stampIds: ids,
          stampCount: ids.length,
          matchingStampCount,
          newStampCountForUser: ids.filter(id => !stampedBy.get(id)?.has(currentUserId)).length,
          groupSize: groupUserIds.length,
          AverageGroupStampings: Math.round(ids.reduce((sum, id) => sum
            + groupUserIds.filter(userId => stampedBy.get(id)?.has(userId)).length, 0)
            / groupUserIds.length * 100) / 100,
          duration, distance, path: [...path],
        });
      }
      // Each hike ends at its car. Multi-parking tours may drive on from here.
      if (!params.allowDriveInRoute) return;
    }
    if (path.length >= params.maxDepth || searchLimited) return;
    for (const edge of adjacent.get(poi) || []) {
      if (usedEdges.has(edge.ID)) continue;
      const drive = edge.travelMode === 'drive';
      if (drive && (!params.allowDriveInRoute || poi !== car || edge.toPoiType !== 'parking')) continue;
      const nextDuration = duration + Number(edge.durationSeconds);
      const nextDistance = distance + (drive ? 0 : Number(edge.distanceMeters));
      if (nextDuration > params.maxDuration || nextDistance > params.maxDistance) continue;
      const nextStamps = new Set(stampIds);
      if (edge.toPoiType === 'stamp') nextStamps.add(edge.toPoi);
      usedEdges.add(edge.ID);
      path.push(edge);
      visit(edge.toPoi, drive ? edge.toPoi : car, path, nextDuration, nextDistance, nextStamps);
      path.pop();
      usedEdges.delete(edge.ID);
      if (searchLimited) break;
    }
  }
  visit(params.startId, params.startId, [], 0, 0, new Set());
  return { results: selectRoutes(routes), searchLimited };
}

function validateParameters(data) {
  const params = {
    ...data,
    maxDepth: data.maxDepth ?? 12,
    maxDistance: data.maxDistance ?? 50000,
    minStampCount: data.minStampCount ?? 1,
    allowDriveInRoute: data.allowDriveInRoute ?? false,
    groupMode: data.groupMode ?? 'missing_any',
  };
  const ranges = { maxDepth: [2, 24], maxDuration: [60, 86400], maxDistance: [1, 200000], minStampCount: [1, 222] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!Number.isInteger(params[key]) || params[key] < min || params[key] > max) {
      throw new Error(`${key} must be an integer between ${min} and ${max}.`);
    }
  }
  for (const [key, max] of [['latitudeStart', 90], ['longitudeStart', 180]]) {
    if (params[key] == null || String(params[key]).trim() === ''
      || !Number.isFinite(Number(params[key])) || Math.abs(Number(params[key])) > max) {
      throw new Error(`${key} must be a valid coordinate.`);
    }
  }
  if (!['missing_all', 'missing_any'].includes(params.groupMode)) throw new Error('Unknown groupMode.');
  if (typeof params.allowDriveInRoute !== 'boolean') throw new Error('allowDriveInRoute must be a boolean.');
  return params;
}

function toTourResult(route, geometryById) {
  const { stampIds, ...result } = route;
  return {
    ...result,
    idListTravelTimes: route.id,
    totalElevationGain: route.path.reduce((sum, edge) => sum + (Number(edge.elevationGain) || 0), 0),
    totalElevationLoss: route.path.reduce((sum, edge) => sum + (Number(edge.elevationLoss) || 0), 0),
    path: route.path.map((edge, rank) => ({
      travelTime_ID: edge.ID,
      rank: (rank + 1) * 512,
      travelTime: { ...edge, positionString: geometryById.get(edge.ID)?.positionString ?? null },
    })),
  };
}

module.exports = { findRoutes, selectRoutes, validateParameters, toTourResult };
