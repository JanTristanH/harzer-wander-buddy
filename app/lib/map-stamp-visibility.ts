import type { StampTypeFilter } from './stamp-catalog';

// Match the parking detail level. Explicit choices and searches bypass this limit.
export const MAP_DETAIL_LONGITUDE_DELTA = 0.18;
export function isMapStampVisible({ special, type, longitudeDelta, explicitFilter = false }: {
  special: boolean; type: StampTypeFilter; longitudeDelta: number; explicitFilter?: boolean;
}) {
  if (type === 'regular') return !special;
  if (type === 'special') return special;
  return !special || type === 'all' || explicitFilter || longitudeDelta < MAP_DETAIL_LONGITUDE_DELTA;
}
