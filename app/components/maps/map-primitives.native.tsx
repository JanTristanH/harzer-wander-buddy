import MapView, {
  Marker,
  Polyline,
  type Camera,
  type LatLng,
  type Region,
} from 'react-native-maps';
import React from 'react';

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

export default NativeMapView;
export { Marker, Polyline };
