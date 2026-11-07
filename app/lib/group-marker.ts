export type StampMarkerKind = 'visited-stamp' | 'open-stamp';

export type StampMarkerVisualKind =
  | StampMarkerKind
  | 'group-open-stamp'
  | 'group-partial-stamp'
  | 'special-open-stamp' | 'special-visited-stamp'
  | 'special-group-open-stamp' | 'special-group-partial-stamp';

export function resolveStampMarkerVisualKind({
  groupActive,
  groupSize,
  personalKind,
  totalGroupStampings,
}: {
  groupActive: boolean;
  groupSize: number;
  personalKind: StampMarkerKind;
  totalGroupStampings: number;
}): StampMarkerVisualKind {
  if (!groupActive || groupSize <= 0) {
    return personalKind;
  }

  if (totalGroupStampings <= 0) {
    return 'group-open-stamp';
  }

  if (totalGroupStampings < groupSize) {
    return 'group-partial-stamp';
  }

  return 'visited-stamp';
}

export function specialMarkerVisualKind(kind: StampMarkerVisualKind): StampMarkerVisualKind {
  const kinds: Partial<Record<StampMarkerVisualKind, StampMarkerVisualKind>> = {
    'open-stamp': 'special-open-stamp', 'visited-stamp': 'special-visited-stamp',
    'group-open-stamp': 'special-group-open-stamp', 'group-partial-stamp': 'special-group-partial-stamp',
  };
  return kinds[kind] || kind;
}
