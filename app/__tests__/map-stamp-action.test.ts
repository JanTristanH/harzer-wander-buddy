import { canCreateMapVisit, getMapPrimaryActionLabel } from '@/lib/map-stamp-action';

describe('map stamp quick action', () => {
  it('allows another visit for an already visited stamp', () => {
    expect(canCreateMapVisit('visited-stamp')).toBe(true);
    expect(
      getMapPrimaryActionLabel({
        isAuthenticated: true,
        isStamping: false,
        kind: 'visited-stamp',
      })
    ).toBe('Erneut stempeln');
  });

  it('keeps parking out of the stamping flow', () => {
    expect(canCreateMapVisit('parking')).toBe(false);
    expect(
      getMapPrimaryActionLabel({
        isAuthenticated: true,
        isStamping: false,
        kind: 'parking',
      })
    ).toBe('Navigation starten');
  });
});
