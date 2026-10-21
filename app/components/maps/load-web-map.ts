// A single dynamic dependency keeps shared map libraries out of eager chunks.
export function loadWebMap() {
  return import('./map-primitives-leaflet.web');
}
