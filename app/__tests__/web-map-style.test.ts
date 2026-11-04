import type { StyleSpecification } from 'maplibre-gl';
import { defaultWebMapStyle, reduceWalkingStyle } from '@/lib/web-map-style';

it('defaults narrow mobile viewports to raster and keeps the desktop default', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  try {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    expect(defaultWebMapStyle()).toBe('raster');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    expect(defaultWebMapStyle()).toBe('standard');
  } finally {
    if (original) Object.defineProperty(window, 'innerWidth', original);
    else Reflect.deleteProperty(window, 'innerWidth');
  }
});

it('reduces visual detail while retaining footpaths, tracks, labels and sources', () => {
  const ids = ['road_minor_casing', 'road_path_pedestrian', 'bridge_path_pedestrian_casing', 'road_service_track', 'road_major_rail_hatching', 'place_town', 'building', 'poi'];
  const style = { version: 8, sources: { terrain: { type: 'vector', url: 'https://example.test/tiles' } }, layers: ids.map(id => ({ id, type: 'line', source: 'terrain', 'source-layer': id === 'building' || id === 'poi' ? id : 'transportation' })) } as StyleSpecification;
  const result = reduceWalkingStyle(style);
  expect(result.layers.map(layer => layer.id)).toEqual(['road_path_pedestrian', 'bridge_path_pedestrian_casing', 'road_service_track', 'place_town']);
  expect(result.sources).toBe(style.sources);
  expect(style.layers).toHaveLength(8);
});
