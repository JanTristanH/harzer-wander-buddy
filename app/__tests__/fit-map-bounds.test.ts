import type { LatLngBounds } from 'leaflet';
import { fitMapBounds } from '@/lib/fit-map-bounds';

it('fits between whole zoom levels and retains the gesture zoom policy', () => {
  let usedSnap: number | undefined;
  const map = { options: { zoomSnap: 1 }, fitBounds: jest.fn(() => { usedSnap = map.options.zoomSnap; }) };
  fitMapBounds(map as never, {} as LatLngBounds, { paddingTopLeft: [48, 180] });
  expect(usedSnap).toBe(0.25);
  expect(map.options.zoomSnap).toBe(1);
});

it('restores the gesture policy if fitting fails during teardown', () => {
  const map = { options: { zoomSnap: 1 }, fitBounds: jest.fn(() => { throw new Error('removed'); }) };
  expect(() => fitMapBounds(map as never, {} as LatLngBounds, {})).toThrow('removed');
  expect(map.options.zoomSnap).toBe(1);
});
