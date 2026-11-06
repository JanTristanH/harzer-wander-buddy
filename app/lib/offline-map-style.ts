import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { type OfflineMapPack, OFFLINE_MAP_MAX_ZOOM, OFFLINE_MAP_MIN_ZOOM } from './offline-maps';

/** All resources are local; the offline renderer has no HTTP source or fallback. */
export function offlineMapStyle(pack: OfflineMapPack, directoryUri: string): StyleSpecification {
  const base = directoryUri.replace(/\/$/, '');
  return {
    version: 8,
    glyphs: `${base}/fonts/{fontstack}/{range}.pbf`,
    sources: { terrain: { type: 'vector', tiles: [`${base}/{z}/{x}/{y}.pbf`],
      minzoom: OFFLINE_MAP_MIN_ZOOM, maxzoom: OFFLINE_MAP_MAX_ZOOM, bounds: pack.bounds,
      attribution: '© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f4f1e8' } },
      { id: 'landcover', type: 'fill', source: 'terrain', 'source-layer': 'landcover',
        paint: { 'fill-color': '#d9e6ca', 'fill-opacity': 0.8 } },
      { id: 'parks', type: 'fill', source: 'terrain', 'source-layer': 'park',
        paint: { 'fill-color': '#cce0bc', 'fill-opacity': 0.5 } },
      { id: 'water', type: 'fill', source: 'terrain', 'source-layer': 'water', paint: { 'fill-color': '#9dcbdc' } },
      { id: 'streams', type: 'line', source: 'terrain', 'source-layer': 'waterway', paint: { 'line-color': '#7fb5d1', 'line-width': 1.5 } },
      { id: 'buildings', type: 'fill', source: 'terrain', 'source-layer': 'building', minzoom: 13,
        paint: { 'fill-color': '#d0c9bf' } },
      { id: 'roads', type: 'line', source: 'terrain', 'source-layer': 'transportation',
        filter: ['!in', 'class', 'path', 'track', 'rail'],
        paint: { 'line-color': '#c5b79b', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 16, 5] } },
      { id: 'walking-paths', type: 'line', source: 'terrain', 'source-layer': 'transportation',
        filter: ['in', 'class', 'path', 'track'],
        paint: { 'line-color': '#9b5636', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 2.5], 'line-dasharray': [2, 1] } },
      { id: 'place-names', type: 'symbol', source: 'terrain', 'source-layer': 'place',
        layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'], 'text-size': 13 },
        paint: { 'text-color': '#293c29', 'text-halo-color': '#faf9f4', 'text-halo-width': 1.5 } },
      { id: 'peaks', type: 'symbol', source: 'terrain', 'source-layer': 'mountain_peak', minzoom: 11,
        layout: { 'text-field': ['concat', ['get', 'name'], ' ', ['to-string', ['get', 'ele']], ' m'],
          'text-font': ['Noto Sans Regular'], 'text-size': 11 },
        paint: { 'text-color': '#665044', 'text-halo-color': '#faf9f4', 'text-halo-width': 1 } },
    ],
  };
}
