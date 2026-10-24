import { buildTourGpx, parseTourGeometry } from '@/lib/tour-gpx';
import type { TourPathEntry } from '@/lib/api';
const leg = (rank: number, geometry = '10.1;51.1;0;10.2;51.2;0', mode = 'pedestrian'): TourPathEntry => ({
  rank, tour_ID: 'tour', travelTime_ID: String(rank), travelTime: {
    ID: String(rank), positionString: geometry, travelMode: mode,
    durationSeconds: null, distanceMeters: null, elevationGain: null, elevationLoss: null,
  },
});
test('exports actual geometry in rank order with GPX latitude/longitude and separate modes', () => {
  const path = [leg(2, '11;52;0;12;53;0;', 'car'), leg(1)];
  const { content, fileName } = buildTourGpx('Bäche & <Berge> / Harz', path);
  expect(content).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
  expect(content).toContain('Bäche &amp; &lt;Berge&gt; / Harz');
  expect(content.indexOf('lat="51.1" lon="10.1"')).toBeLessThan(content.indexOf('lat="52" lon="11"'));
  expect(content.match(/<trkseg>/g)).toHaveLength(2);
  expect(content).toContain('<type>driving</type>');
  expect(content).not.toContain('<ele>');
  expect(fileName).toBe('Bäche-Berge-Harz.gpx');
  expect(path[0].rank).toBe(2);
});
test.each(['', '10;51;0', '10;51;0;11', '181;51;0;10;52;0', '10;91;0;11;52;0', 'NaN;51;0;10;52;0', ';51;0;10;52;0'])('rejects corrupt or missing geometry: %s', value => {
  expect(() => parseTourGeometry(value)).toThrow();
});
test('refuses incomplete tours instead of silently exporting a partial route', () => {
  expect(() => buildTourGpx('Test', [])).toThrow();
  expect(() => buildTourGpx('Test', [leg(1), leg(2, '')])).toThrow();
});
test('retains valid zero and negative coordinates and strips illegal XML controls', () => {
  expect(parseTourGeometry('0;0;0;-1;-2;0')).toEqual([{ latitude: 0, longitude: 0 }, { latitude: -2, longitude: -1 }]);
  expect(buildTourGpx('A\u0000B', [leg(1)]).content).toContain('<name>AB</name>');
});
