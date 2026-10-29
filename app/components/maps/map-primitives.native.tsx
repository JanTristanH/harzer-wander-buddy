import MapView, {
  Marker as NativeMarker,
  Polyline,
  type Camera,
  type LatLng,
  type Region,
} from 'react-native-maps';
import React from 'react';
import { SELECTED_MARKER_Z_INDEX } from '@/lib/map-marker-selection';

export type { Camera, LatLng, Region };

export type MapViewRef = MapView;
type NativeMapViewProps = React.ComponentProps<typeof MapView> & {
  attributionPlacement?: 'bottom-right' | 'below-zoom';
};

const NativeMapView = React.forwardRef<MapView, NativeMapViewProps>(function NativeMapView(
  { attributionPlacement: _attributionPlacement, ...props },
  ref
) {
  return <MapView ref={ref} {...props} />;
});

type MarkerProps = React.ComponentProps<typeof NativeMarker> & {
  selected?: boolean;
  /** Tour badges/halos must not cover the selected GPS pin. */
  selectionOverlay?: boolean;
};

const SELECTED_PIN_IMAGE = require('@/assets/images/map/selected-pin.png');

const Marker = React.forwardRef<React.ComponentRef<typeof NativeMarker>, MarkerProps>(function Marker(
  { selected: selectedProp, selectionOverlay = false, ...props },
  ref
) {
  const selected = selectedProp ?? props.accessibilityState?.selected ?? false;
  if (selected && selectionOverlay) return null;

  return (
    <NativeMarker
      {...props}
      // Recreate only the changed native marker to discard stale child snapshots
      // when returning from a bitmap to a custom group marker with tracking off.
      key={selected ? 'selected' : 'normal'}
      ref={ref}
      accessibilityState={{ ...props.accessibilityState, selected }}
      image={selected ? SELECTED_PIN_IMAGE : props.image}
      tracksViewChanges={selected ? false : props.tracksViewChanges}
      zIndex={selected ? SELECTED_MARKER_Z_INDEX : props.zIndex}>
      {selected ? null : props.children}
    </NativeMarker>
  );
});

export default NativeMapView;
export { Marker, Polyline };
