import { matchesStampTheme } from '@/lib/stamp-catalog';

const stamp = (catalogKey: string, themeKeys = '["grenzweg"]') => ({
  catalogKey, themeKeys, number: '9900', stampType: 'special' as const,
});

test('badge relevance includes the three actual special requirements, not every Grenzweg stamp', () => {
  for (const key of ['special-jungborn', 'special-two-countries-oak', 'special-three-countries-stone']) {
    expect(matchesStampTheme(stamp(key), 'badge-relevant')).toBe(true);
  }
  expect(matchesStampTheme(stamp('special-9900'), 'badge-relevant')).toBe(false);
  expect(matchesStampTheme(stamp('special-9900'), 'grenzweg')).toBe(true);
  expect(matchesStampTheme(stamp('special-9900'), 'talsperren')).toBe(false);
  expect(matchesStampTheme(stamp('special-9900'), '')).toBe(true);
  expect(matchesStampTheme({ number: '1', stampType: 'regular', catalogKey: 'hwn-1' }, 'badge-relevant')).toBe(false);
});


test('badge filter preserves the explicit aliases and historical border identities from the integrated catalogue', () => {
  expect(matchesStampTheme(stamp('hwn:special:jungborn'), 'badge-relevant')).toBe(true);
  expect(matchesStampTheme({ number: 'SX-Zwei-Länder-Eiche' }, 'badge-relevant')).toBe(true);
  expect(matchesStampTheme({ number: '9903' }, 'badge-relevant')).toBe(true);
  expect(matchesStampTheme({ number: '9900' }, 'badge-relevant')).toBe(false);
  expect(matchesStampTheme({ number: '9901', catalogKey: 'special-another-place' }, 'badge-relevant')).toBe(false);
});
