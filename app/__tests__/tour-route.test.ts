import { buildRouteDirectionArrows, buildTourRouteSegments, parseRoutePositionString } from '@/lib/tour-route';
import type { TourPathEntry } from '@/lib/api';

const positionString = '10.6;51.7;0;10.61;51.72;0;10.62;51.71;0';
function leg(fromPoi: string, toPoi: string, rank: number, position = positionString): TourPathEntry {
  return {
    rank, tour_ID: 'tour', travelTime_ID: `${fromPoi}-${toPoi}`,
    travelTime: {
      ID: `${fromPoi}-${toPoi}`, fromPoi, toPoi, positionString: position,
      distanceMeters: null, durationSeconds: null, elevationGain: null, elevationLoss: null,
    },
  };
}

describe('OData tour route geometry', () => {
  it('converts UI5 longitude/latitude triples and retains intermediate bends and the final point', () => {
    const expected = [
      { latitude: 51.7, longitude: 10.6 },
      { latitude: 51.72, longitude: 10.61 },
      { latitude: 51.71, longitude: 10.62 },
    ];
    expect(parseRoutePositionString(positionString)).toEqual(expected);
    expect(parseRoutePositionString(`${positionString};`)).toEqual(expected);
  });

  it.each([undefined, '', '10;51;0', '10;51', '10;;0;11;52;0',
    '10;51;0;NaN;52;0', '10;51;0;11;91;0', '10;51;0;181;52;0'])
  ('omits unusable geometry without drawing across invalid points: %s', (value) => {
    expect(parseRoutePositionString(value)).toEqual([]);
  });

  it('keeps legs separate, follows draft order, and omits gaps rather than connecting them', () => {
    const first = leg('a', 'b', 1);
    const last = leg('c', 'd', 3, '11;52;0;11.1;52.1;0');
    expect(buildTourRouteSegments([last, leg('b', 'c', 2, ''), first], ['A', 'b', 'c', 'd']))
      .toEqual([{ coordinates: parseRoutePositionString(positionString), mode: 'walk' },
        { coordinates: parseRoutePositionString(last.travelTime!.positionString), mode: 'walk' }]);
    expect(buildTourRouteSegments([first, last], ['a', 'd'])).toEqual([]);
    expect(buildTourRouteSegments([first], ['b', 'a'])).toEqual([]);
  });
});

it.each(['drive', 'CAR', 'motor_vehicle', ' auto '])('preserves driving mode %s independently of geometry', (travelMode) => {
  const driving = leg('a', 'b', 1);
  driving.travelTime!.travelMode = travelMode;
  const walking = leg('b', 'c', 2);
  walking.travelTime!.travelMode = 'walk';
  expect(buildTourRouteSegments([walking, driving], ['a', 'b', 'c']).map(({ mode }) => mode))
    .toEqual(['drive', 'walk']);
});

describe('route direction chevrons', () => {
  const east = [{ latitude: 51.7, longitude: 10.6 }, { latitude: 51.7, longitude: 10.62 }];
  it('points along the ordered route and reverses with the route', () => {
    for (const [coordinates, sign] of [[east, 1], [[...east].reverse(), -1]] as const) {
      const arrows = buildRouteDirectionArrows([...coordinates], 0.02, 400);
      expect(arrows.length).toBeGreaterThan(0);
      for (const [left, tip, right] of arrows) {
        expect((tip.longitude - left.longitude) * sign).toBeGreaterThan(0);
        expect((tip.longitude - right.longitude) * sign).toBeGreaterThan(0);
        expect(tip.latitude).toBe(51.7);
      }
    }
  });
  it('uses the local direction after a bend and ignores duplicate coordinates', () => {
    const coordinates = [east[0], east[0], east[1], { latitude: 51.72, longitude: 10.62 }];
    const arrows = buildRouteDirectionArrows(coordinates, 0.02, 400);
    const northArrow = arrows.find(([, tip]) => tip.latitude > 51.7)!;
    expect(northArrow).toBeDefined();
    expect(northArrow[1].latitude).toBeGreaterThan(northArrow[0].latitude);
    expect(northArrow[1].latitude).toBeGreaterThan(northArrow[2].latitude);
    expect(arrows.flat().every(({ latitude, longitude }) => Number.isFinite(latitude + longitude))).toBe(true);
  });
  it('keeps screen size on zoom and omits short or degenerate legs', () => {
    const overview = buildRouteDirectionArrows(east, 0.04, 400);
    const zoomed = buildRouteDirectionArrows(east, 0.02, 400);
    expect(zoomed.length).toBeGreaterThan(overview.length);
    expect(overview[0][1].longitude - overview[0][0].longitude)
      .toBeCloseTo(2 * (zoomed[0][1].longitude - zoomed[0][0].longitude));
    expect(buildRouteDirectionArrows(east, 4, 400)).toEqual([]);
    expect(buildRouteDirectionArrows([east[0], east[0]], 0.02, 400)).toEqual([]);
    expect(buildRouteDirectionArrows([], 0.02, 400)).toEqual([]);
    expect(buildRouteDirectionArrows(east, 0, 400)).toEqual([]);
  });
});
