import MapView, {
  Marker as NativeMarker,
  Polyline,
  type Camera,
  type LatLng,
  type Region,
} from 'react-native-maps';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SELECTED_MARKER_Z_INDEX } from '@/lib/map-marker-selection';
import { isPreviewMapBlocked, recordPreviewEvent } from '@/lib/preview-diagnostics';

export type { Camera, LatLng, Region };

export type MapViewRef = MapView;
type NativeMapViewProps = React.ComponentProps<typeof MapView> & {
  attributionPlacement?: 'bottom-right' | 'below-zoom';
  scrollWheelZoomEnabled?: boolean;
};

const NativeMapView = React.forwardRef<MapView, NativeMapViewProps>(function NativeMapView(
  { attributionPlacement: _attributionPlacement, scrollWheelZoomEnabled: _scrollWheelZoomEnabled, ...props },
  ref
) {
  useEffect(() => {
    void recordPreviewEvent(isPreviewMapBlocked ? 'map.blocked_missing_key' : 'map.opened');
  }, []);
  if (isPreviewMapBlocked) {
    return (
      <View style={[props.style, styles.unavailable]} accessibilityRole="alert">
        <Text style={styles.title}>Karte in dieser Preview nicht verfügbar</Text>
        <Text style={styles.message}>Der Google-Maps-Key fehlt in diesem Android-Build. Liste und Anmeldung können weiter verwendet werden.</Text>
        <Text style={styles.message}>Details stehen im Profil unter „Technische Details → Preview-Protokoll“.</Text>
      </View>
    );
  }
  return <MapView ref={ref} {...props} onMapReady={(event) => {
    void recordPreviewEvent('map.ready');
    props.onMapReady?.(event);
  }} />;
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

const styles = StyleSheet.create({
  unavailable: { flex: 1, backgroundColor: '#f3f5ee', justifyContent: 'center', padding: 28, gap: 14 },
  title: { color: '#1e2a1e', fontSize: 20, fontWeight: '600' },
  message: { color: '#4d5d4d', fontSize: 15, lineHeight: 22 },
});
