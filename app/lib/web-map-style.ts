import type { StyleSpecification } from 'maplibre-gl';

export const WEB_MAP_STYLES = {
  standard: { label: 'Standard', url: 'https://tiles.openfreemap.org/styles/liberty' },
  light: { label: 'Hell', url: 'https://tiles.openfreemap.org/styles/positron' },
  walking: { label: 'Wandern reduziert', url: 'https://tiles.openfreemap.org/styles/liberty' },
} as const;

export type WebMapStyleId = keyof typeof WEB_MAP_STYLES;

export function reduceWalkingStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.filter((layer) => {
      const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;
      // Retain paths, tracks, terrain, water and place/road labels for orientation.
      if (['building', 'poi', 'aeroway', 'aerodrome_label'].includes(sourceLayer ?? '')) return false;
      if (layer.id.endsWith('_hatching') || layer.id.startsWith('road_one_way_arrow')) return false;
      return !layer.id.endsWith('_casing') || layer.id.includes('path_pedestrian');
    }),
  };
}
