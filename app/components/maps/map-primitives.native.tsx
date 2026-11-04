import MapView, {
  Marker as NativeMarker,
  Polyline,
  type Camera,
  type LatLng,
  type Region,
} from 'react-native-maps';
import React from 'react';
import { Image, Text, View } from 'react-native';
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
  noticeBadge?: boolean;
  selected?: boolean;
  /** Tour badges/halos must not cover the selected GPS pin. */
  selectionOverlay?: boolean;
};

const SELECTED_PIN_IMAGE = require('@/assets/images/map/selected-pin.png');

const Marker = React.forwardRef<React.ComponentRef<typeof NativeMarker>, MarkerProps>(function Marker(
  { selected: selectedProp, selectionOverlay = false, noticeBadge = false, ...props },
  ref
) {
  const selected = selectedProp ?? props.accessibilityState?.selected ?? false;
  const innerRef = React.useRef<React.ComponentRef<typeof NativeMarker>>(null);
  React.useImperativeHandle(ref, () => innerRef.current as React.ComponentRef<typeof NativeMarker>);
  const showNotice = noticeBadge && !selected;
  if (selected && selectionOverlay) return null;

  return (
    <NativeMarker
      {...props}
      // Recreate only the changed native marker to discard stale child snapshots
      // when returning from a bitmap to a custom group marker with tracking off.
      key={selected ? 'selected' : 'normal'}
      ref={innerRef}
      accessibilityState={{ ...props.accessibilityState, selected }}
      image={selected ? SELECTED_PIN_IMAGE : showNotice ? undefined : props.image}
      tracksViewChanges={selected ? false : props.tracksViewChanges}
      zIndex={selected ? SELECTED_MARKER_Z_INDEX : props.zIndex}>
      {selected ? null : showNotice ? <View collapsable={false} style={{ width: 48, height: 52 }}>
        {props.image ? <Image onLoad={() => innerRef.current?.redraw()} source={props.image} style={{ width: 48, height: 52 }} /> : props.children}
        <Text style={{ position: 'absolute', right: 0, top: 0, borderRadius: 9, backgroundColor: '#ffe19a', color: '#713b09', fontSize: 13, paddingHorizontal: 3 }}>⚡</Text>
      </View> : props.children}
    </NativeMarker>
  );
});

export default NativeMapView;
export { Marker, Polyline };
