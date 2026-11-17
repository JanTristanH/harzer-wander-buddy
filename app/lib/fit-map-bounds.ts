import type { FitBoundsOptions, LatLngBounds, Map } from 'leaflet';

/** Use the available viewport for fitting without changing gesture zoom steps. */
export function fitMapBounds(map: Pick<Map, 'options' | 'fitBounds'>, bounds: LatLngBounds, options: FitBoundsOptions) {
  const gestureSnap = map.options.zoomSnap;
  map.options.zoomSnap = 0.25;
  try {
    map.fitBounds(bounds, options);
  } finally {
    map.options.zoomSnap = gestureSnap;
  }
}
