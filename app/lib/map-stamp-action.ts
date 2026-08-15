export type MapStampActionKind = 'visited-stamp' | 'open-stamp' | 'parking';

export function canCreateMapVisit(kind: MapStampActionKind) {
  return kind === 'visited-stamp' || kind === 'open-stamp';
}

export function getMapPrimaryActionLabel(options: {
  isAuthenticated: boolean;
  isStamping: boolean;
  kind: MapStampActionKind;
}) {
  if (options.kind === 'parking') {
    return 'Navigation starten';
  }

  if (options.isStamping) {
    return 'Registriere Besuch...';
  }

  if (!options.isAuthenticated) {
    return 'Anmelden zum Stempeln';
  }

  return options.kind === 'visited-stamp' ? 'Erneut stempeln' : 'Besuch registrieren';
}
