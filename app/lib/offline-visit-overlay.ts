import { useMemo } from 'react';

import type { MapData, ProfileOverviewData, Stampbox, StampDetailData, UserProfileOverviewData, VisitStamping } from '@/lib/api';
import type { OfflineVisit } from '@/lib/offline-visit-queue';
import { useOfflineVisits } from '@/lib/offline-visits';

type Overview = { stamps: Stampbox[]; lastVisited: { stampId: string; visitedAt?: string; stampNumber?: string; stampName: string } | null };
export type OverlayKind = 'stamps' | 'map' | 'detail' | 'profile' | 'user-profile';

type Options = { userId?: string; filter?: string; groupUserIds?: string[] };

function markStamp(stamp: Stampbox, entries: readonly OfflineVisit[], userId: string) {
  const visits = entries.filter((entry) => entry.stamp.ID === stamp.ID);
  if (!visits.length) return stamp;
  const latest = visits.reduce((a, b) => a.visitedAt > b.visitedAt ? a : b);
  const existingVisitTime = (stamp as Stampbox & { visitedAt?: string }).visitedAt;
  const visitedAt = existingVisitTime && Date.parse(existingVisitTime) > Date.parse(latest.visitedAt) ? existingVisitTime : latest.visitedAt;
  const alreadyIncluded = Boolean(stamp.hasVisited || stamp.stampedUserIds?.includes(userId));
  return {
    ...stamp, hasVisited: true,
    visitedAt,
    ...('kind' in stamp ? { kind: 'visited-stamp' } : {}),
    totalGroupStampings: (stamp.totalGroupStampings ?? 0) + (alreadyIncluded ? 0 : 1),
    stampedUserIds: [...new Set([...(stamp.stampedUserIds ?? []), userId])],
  };
}

function timeline(entries: readonly OfflineVisit[], existing: ProfileOverviewData['stampings']) {
  const byId = new Map(existing.map((visit) => [visit.id, visit]));
  for (const entry of entries) {
    if (!byId.has(entry.id)) byId.set(entry.id, {
      id: entry.id, stampId: entry.stamp.ID, stampNumber: entry.stamp.number,
      stampName: entry.stamp.name, visitedAt: entry.visitedAt,
      heroImageUrl: entry.stamp.heroImageUrl || entry.stamp.image,
    });
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.visitedAt || '') - Date.parse(a.visitedAt || ''));
}

// Overlay server/cache data at read time, never persist a synthetic server response.
// Refetches cannot erase the outbox, and removing an entry reveals the real data again.
export function overlayOfflineVisits<T>(data: T | undefined, kind: OverlayKind, entries: readonly OfflineVisit[], options: Options): T | undefined {
  const userId = options.userId;
  if (!userId || !entries.length || !data) return data;
  if (kind === 'stamps' || kind === 'map') {
    const original = data as unknown as Overview & MapData;
    let stamps = original.stamps.map((stamp) => markStamp(stamp, entries, userId));
    if (kind === 'stamps' && options.filter === 'visited') {
      for (const entry of entries) {
        if (!stamps.some((stamp) => stamp.ID === entry.stamp.ID)) {
          stamps.push(markStamp({ ...entry.stamp, hasVisited: false, totalGroupStampings: 0, stampedUserIds: [] }, entries, userId));
        }
      }
    }
    if (options.filter === 'open') stamps = stamps.filter((stamp) => !entries.some((entry) => entry.stamp.ID === stamp.ID));
    const last = entries.reduce((a, b) => a.visitedAt > b.visitedAt ? a : b);
    return {
      ...original, stamps,
      ...(kind === 'stamps' && (!original.lastVisited?.visitedAt || original.lastVisited.visitedAt <= last.visitedAt)
        ? { lastVisited: { stampId: last.stamp.ID, stampName: last.stamp.name, stampNumber: last.stamp.number, visitedAt: last.visitedAt } } : {}),
    } as T;
  }
  if (kind === 'detail') {
    const original = data as unknown as StampDetailData;
    const visits = entries.filter((entry) => entry.stamp.ID === original.stamp.ID);
    const added: VisitStamping[] = visits.filter((entry) => !original.myVisits.some((visit) => visit.ID === entry.id)).map((entry) => ({
      ID: entry.id, stamp_ID: entry.stamp.ID, stamp: entry.stamp, visitedAt: entry.visitedAt,
      createdBy: userId, pendingSync: true,
    }));
    return { ...original, stamp: markStamp(original.stamp, entries, userId), myVisits: [...added, ...original.myVisits].sort((a, b) => Date.parse(b.visitedAt || b.createdAt || '') - Date.parse(a.visitedAt || a.createdAt || '')) } as T;
  }
  if (kind === 'profile') {
    const original = data as unknown as ProfileOverviewData;
    const stamps = original.stamps.map((stamp) => markStamp(stamp, entries, userId));
    const addedPlaces = stamps.filter((stamp, index) => stamp.hasVisited && !original.stamps[index].hasVisited).length;
    const visitedCount = Math.min(original.totalCount, original.visitedCount + addedPlaces);
    const stampings = timeline(entries, original.stampings ?? original.latestVisits);
    return { ...original, stamps, visitedCount, openCount: Math.max(0, original.totalCount - visitedCount),
      completionPercent: original.totalCount ? Math.round(visitedCount / original.totalCount * 100) : 0,
      stampings, latestVisits: stampings.slice(0, 3),
    } as T;
  }
  const original = data as unknown as UserProfileOverviewData;
  const stampComparisons = original.stampComparisons.map((comparison) => {
    const pending = entries.some((entry) => entry.stamp.ID === comparison.stamp.ID);
    return pending ? { ...comparison, meVisited: true, ...(original.userId === userId ? { userVisited: true } : {}) } : comparison;
  });
  const stampBuckets = {
    shared: stampComparisons.filter((item) => item.meVisited && item.userVisited).length,
    friendOnly: stampComparisons.filter((item) => !item.meVisited && item.userVisited).length,
    meOnly: stampComparisons.filter((item) => item.meVisited && !item.userVisited).length,
    neither: stampComparisons.filter((item) => !item.meVisited && !item.userVisited).length,
  };
  const own = original.userId === userId;
  const stampings = own ? timeline(entries, original.stampings ?? original.latestVisits) : original.stampings;
  const addedCount = own ? stampComparisons.filter((item, index) => item.userVisited && !original.stampComparisons[index].userVisited).length : 0;
  const visitedCount = original.visitedCount + addedCount;
  return { ...original, stampComparisons, stampBuckets, sharedVisitedCount: stampBuckets.shared,
    ...(own ? { stampings, latestVisits: stampings.slice(0, 3), visitedCount,
      completionPercent: stampComparisons.length ? Math.round(visitedCount / stampComparisons.length * 100) : original.completionPercent } : {}),
  } as T;
}

export function useOfflineVisitData<T>(data: T | undefined, kind: OverlayKind, options: Options) {
  const offline = useOfflineVisits();
  return useMemo(() => overlayOfflineVisits(data, kind,
    offline.userId === options.userId ? offline.entries : [], options),
  // Group-specific server data is already represented by `data`.
  [data, kind, offline.entries, offline.userId, options.userId, options.filter]); // eslint-disable-line react-hooks/exhaustive-deps
}
