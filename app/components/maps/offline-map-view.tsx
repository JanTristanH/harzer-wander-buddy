import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import type { MapStamp } from '@/lib/api';
import { offlineMapDirectory } from '@/lib/offline-map-storage';
import { offlineMapStyle } from '@/lib/offline-map-style';
import { OFFLINE_MAP_MIN_ZOOM, type OfflineMapPack } from '@/lib/offline-maps';
import { useMapLocation } from '@/hooks/use-map-location';

export type OfflineMapViewProps = { pack: OfflineMapPack; stamps: MapStamp[]; onStampPress: (id: string) => void };
export function OfflineMapView({ pack, stamps, onStampPress }: OfflineMapViewProps) {
  const camera = useRef<CameraRef>(null);
  const [failed, setFailed] = useState(false);
  const { locateMe, userLocation, locationState } = useMapLocation();
  const style = useMemo(() => offlineMapStyle(pack, offlineMapDirectory(pack).uri), [pack]);
  const [west, south, east, north] = pack.bounds;
  const markers = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: stamps
    .filter(stamp => typeof stamp.longitude === 'number' && typeof stamp.latitude === 'number' &&
      stamp.longitude >= west && stamp.longitude <= east && stamp.latitude >= south && stamp.latitude <= north)
    .map(stamp => ({ type: 'Feature', id: stamp.ID, properties: { id: stamp.ID, name: stamp.name, visited: stamp.kind === 'visited-stamp' },
      geometry: { type: 'Point', coordinates: [stamp.longitude!, stamp.latitude!] } })) }), [stamps, west, south, east, north]);
  async function locate() {
    const position = await locateMe();
    if (!position) return;
    if (position.longitude < west || position.longitude > east || position.latitude < south || position.latitude > north) {
      Alert.alert('Außerhalb der Karte', 'Dein Standort liegt außerhalb dieses gespeicherten Ausschnitts.');
      return;
    }
    camera.current?.flyTo({ center: [position.longitude, position.latitude], zoom: 15, duration: 600 });
  }
  return <View style={styles.container}>
    <Map mapStyle={style} style={styles.map} onDidFailLoadingMap={() => setFailed(true)}>
      <Camera ref={camera} initialViewState={{ center: [(west + east) / 2, (south + north) / 2], zoom: 12 }}
        minZoom={OFFLINE_MAP_MIN_ZOOM} maxZoom={18} maxBounds={pack.bounds} />
      <GeoJSONSource id="offline-stamps" data={markers} onPress={event => {
        const id = event.nativeEvent.features?.[0]?.properties?.id;
        if (typeof id === 'string') onStampPress(id);
      }}>
        <Layer id="offline-stamp-circles" type="circle" paint={{ 'circle-radius': 7,
          'circle-color': ['case', ['get', 'visited'], '#2e6b4b', '#c9732b'],
          'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }} />
      </GeoJSONSource>
      {userLocation ? <GeoJSONSource id="offline-position" data={{ type: 'Point', coordinates: [userLocation.longitude, userLocation.latitude] }}>
        <Layer id="offline-position-circle" type="circle" paint={{ 'circle-radius': 7, 'circle-color': '#3378d5', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }} />
      </GeoJSONSource> : null}
    </Map>
    <View style={styles.legend}><Text style={styles.text}>Grün: besucht · Orange: offen · Blau: Standort</Text>
      <Text style={styles.text}>© OpenStreetMap-Mitwirkende · OpenMapTiles · OpenFreeMap</Text></View>
    {failed ? <View style={styles.error}><Text>Die gespeicherte Karte konnte nicht geladen werden. Bitte lade den Ausschnitt erneut herunter.</Text></View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Mein Standort auf der Offline-Karte" disabled={locationState === 'loading'} onPress={() => void locate()} style={styles.locate}>
      <Text>{locationState === 'loading' ? 'Standort wird ermittelt …' : 'Mein Standort'}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, map: { flex: 1 },
  legend: { padding: 8, backgroundColor: '#faf9f4', gap: 4 }, text: { fontSize: 10, color: '#3f503f' },
  locate: { position: 'absolute', right: 16, top: 16, borderRadius: 16, backgroundColor: '#fff', padding: 14 },
  error: { position: 'absolute', left: 16, right: 16, top: 80, borderRadius: 12, padding: 16, backgroundColor: '#ffe4da' },
});
