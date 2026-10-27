import { buildTourRouteSegments, parseRoutePositionString } from '@/lib/tour-route';
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
      .toEqual([parseRoutePositionString(positionString), parseRoutePositionString(last.travelTime!.positionString)]);
    expect(buildTourRouteSegments([first, last], ['a', 'd'])).toEqual([]);
    expect(buildTourRouteSegments([first], ['b', 'a'])).toEqual([]);
  });
});
