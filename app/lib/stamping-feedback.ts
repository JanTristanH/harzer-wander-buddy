import type { BadgeEntry } from './badge-types';

export type StampingFeedback = {
  visitIds: string[];
  visitCount: number;
  beforeCount: number;
  afterCount: number;
  newPlaces: number;
  repeatCount: number;
  places: string[];
  visitedAt: string | null;
  newBadges: BadgeEntry[];
  nextGoal: BadgeEntry | null;
};

export type ConfirmedStamping = {
  owner: string;
  visitIds: string[];
  eventId?: string;
  friendVisitCount?: number;
};

const listeners = new Set<(event: ConfirmedStamping) => void>();
export function subscribeStampingSuccess(listener: (event: ConfirmedStamping) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Only call after server acknowledgement, never after adding to a local outbox.
export function publishStampingSuccess(event: ConfirmedStamping) {
  if (!event.owner || (!event.visitIds.length && !event.friendVisitCount)) return;
  listeners.forEach(listener => listener(event));
}
