export type StampMarkerKind = 'visited-stamp' | 'open-stamp';

export type StampMarkerVisualKind =
  | StampMarkerKind
  | 'group-open-stamp'
  | 'group-partial-stamp';

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
