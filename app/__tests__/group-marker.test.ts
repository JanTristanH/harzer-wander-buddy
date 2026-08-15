import { resolveStampMarkerVisualKind } from '@/lib/group-marker';
import { getPreGeneratedMapMarkerImageSource } from '@/lib/map-marker-images';

describe('group stamp marker visuals', () => {
  it.each([
    {
      expected: 'group-open-stamp',
      totalGroupStampings: 0,
    },
    {
      expected: 'group-partial-stamp',
      totalGroupStampings: 1,
    },
    {
      expected: 'visited-stamp',
      totalGroupStampings: 2,
    },
  ] as const)(
    'resolves $expected for $totalGroupStampings of 2 visits',
    ({ expected, totalGroupStampings }) => {
      expect(
        resolveStampMarkerVisualKind({
          groupActive: true,
          groupSize: 2,
          personalKind: 'open-stamp',
          totalGroupStampings,
        })
      ).toBe(expected);
    }
  );

  it('keeps the personal marker kind without an active group', () => {
    expect(
      resolveStampMarkerVisualKind({
        groupActive: false,
        groupSize: 1,
        personalKind: 'open-stamp',
        totalGroupStampings: 0,
      })
    ).toBe('open-stamp');
  });

  it('provides pre-generated native images for open and partial group markers', () => {
    expect(
      getPreGeneratedMapMarkerImageSource({
        kind: 'group-open-stamp',
        label: '1',
      })
    ).toBeDefined();
    expect(
      getPreGeneratedMapMarkerImageSource({
        kind: 'group-partial-stamp',
        label: '222',
      })
    ).toBeDefined();
  });
});
