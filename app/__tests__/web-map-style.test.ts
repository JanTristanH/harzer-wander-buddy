import type { StyleSpecification } from 'maplibre-gl';
import { reduceWalkingStyle } from '@/lib/web-map-style';

it('reduces visual detail while retaining footpaths, tracks, labels and sources', () => {
  const ids = ['road_minor_casing', 'road_path_pedestrian', 'bridge_path_pedestrian_casing', 'road_service_track', 'road_major_rail_hatching', 'place_town', 'building', 'poi'];
  const style = { version: 8, sources: { terrain: { type: 'vector', url: 'https://example.test/tiles' } }, layers: ids.map(id => ({ id, type: 'line', source: 'terrain', 'source-layer': id === 'building' || id === 'poi' ? id : 'transportation' })) } as StyleSpecification;
  const result = reduceWalkingStyle(style);
  expect(result.layers.map(layer => layer.id)).toEqual(['road_path_pedestrian', 'bridge_path_pedestrian_casing', 'road_service_track', 'place_town']);
  expect(result.sources).toBe(style.sources);
  expect(style.layers).toHaveLength(8);
});
