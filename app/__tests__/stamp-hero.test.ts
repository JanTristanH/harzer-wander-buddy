import { getStampHeroHeight } from '@/lib/stamp-hero';

it('expands suitable images up to 320 pixels', () => {
  expect(getStampHeroHeight(390, 844, { width: 1200, height: 1000 })).toBe(320);
  expect(getStampHeroHeight(390, 844, { width: 1200, height: 900 })).toBe(292.5);
});

it('limits growth on short screens and keeps panoramas compact', () => {
  expect(getStampHeroHeight(390, 650, { width: 1000, height: 1000 })).toBe(273);
  expect(getStampHeroHeight(390, 844, { width: 2000, height: 600 })).toBe(240);
});

it('keeps placeholders and invalid image sizes at the fallback height', () => {
  expect(getStampHeroHeight(390, 844)).toBe(240);
  expect(getStampHeroHeight(390, 844, { width: 0, height: 900 })).toBe(240);
  expect(getStampHeroHeight(390, 844, { width: 1200, height: NaN })).toBe(240);
});
