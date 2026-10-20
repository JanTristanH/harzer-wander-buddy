import { overlayOfflineVisits } from '@/lib/offline-visit-overlay';
import type { OfflineVisit } from '@/lib/offline-visit-queue';
import type { ProfileOverviewData, Stampbox, StampDetailData } from '@/lib/api';
const stamp = { ID: 'stamp', name: 'Brocken', number: '1', hasVisited: false, totalGroupStampings: 1, stampedUserIds: ['bob'] } as Stampbox;
const entry = { id: 'local-1', stamp, visitedAt: '2026-10-20T08:00:00Z', status: 'pending' } as OfflineVisit;

it('overlays list, map and group status without changing the cached original', () => {
  const original = { stamps: [stamp], lastVisited: null };
  const result = overlayOfflineVisits(original, 'stamps', [entry], { userId: 'alice' });
  expect(result?.stamps[0]).toMatchObject({ hasVisited: true, totalGroupStampings: 2, stampedUserIds: ['bob', 'alice'] });
  expect(original.stamps[0].hasVisited).toBe(false);
  expect(overlayOfflineVisits(original, 'stamps', [], { userId: 'alice' })).toBe(original);
});

it('excludes pending places from open and includes them in visited results', () => {
  expect(overlayOfflineVisits({ stamps: [stamp], lastVisited: null }, 'stamps', [entry], { userId: 'alice', filter: 'open' })?.stamps).toEqual([]);
  expect(overlayOfflineVisits({ stamps: [] as Stampbox[], lastVisited: null }, 'stamps', [entry], { userId: 'alice', filter: 'visited' })?.stamps[0].hasVisited).toBe(true);
});

it('counts a place once but keeps intentional repeat visits in the profile timeline', () => {
  const original = { stamps: [stamp], stampings: [], latestVisits: [], visitedCount: 0, openCount: 1, totalCount: 1 } as unknown as ProfileOverviewData;
  const result = overlayOfflineVisits(original, 'profile', [entry, { ...entry, id: 'local-2' }], { userId: 'alice' });
  expect(result?.visitedCount).toBe(1); expect(result?.stampings).toHaveLength(2);
  expect(result?.completionPercent).toBe(100);
});

it('does not duplicate acknowledged IDs in details or timeline during refetch', () => {
  const original = { stamp: { ...stamp, hasVisited: true }, myVisits: [{ ID: entry.id }] } as StampDetailData;
  expect(overlayOfflineVisits(original, 'detail', [entry], { userId: 'alice' })?.myVisits).toHaveLength(1);
  const empty = { stamp, myVisits: [] } as unknown as StampDetailData;
  expect(overlayOfflineVisits(empty, 'detail', [entry], { userId: 'alice' })?.myVisits[0]).toMatchObject({ ID: entry.id, pendingSync: true, visitedAt: entry.visitedAt });
});
