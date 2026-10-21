import React, { createContext, forwardRef, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { loadWebMap } from './load-web-map';

import type {
  default as MapViewComponent, MapViewRef, Marker as MarkerComponent, Polyline as PolylineComponent,
} from './map-primitives-leaflet.web';

export type { Camera, LatLng, MapViewRef, Region } from './map-primitives-leaflet.web';

type MapModule = typeof import('./map-primitives-leaflet.web');
const MapImplementation = createContext<MapModule | null>(null);

// Keep Leaflet and MapLibre behind one import boundary. Route splitting alone
// hoists these shared dependencies into Expo's eager common chunk.
const MapView = forwardRef<MapViewRef, React.ComponentProps<typeof MapViewComponent>>(
  function MapView(props, ref) {
    const [implementation, setImplementation] = useState<MapModule | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
      let active = true;
      setFailed(false);
      loadWebMap().then(
        (module) => { if (active) setImplementation(module); },
        () => { if (active) setFailed(true); }
      );
      return () => { active = false; };
    }, [attempt]);

    if (!implementation) {
      return (
        <View style={[props.style, { alignItems: 'center', justifyContent: 'center' }]}>
          {failed ? (
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
              <Text>Karte konnte nicht geladen werden. Erneut versuchen</Text>
            </Pressable>
          ) : <ActivityIndicator accessibilityLabel="Karte wird geladen" color="#2e6b4b" />}
        </View>
      );
    }

    const LoadedMap = implementation.default;
    return (
      <MapImplementation.Provider value={implementation}>
        <LoadedMap {...props} ref={ref} />
      </MapImplementation.Provider>
    );
  }
);

export function Marker(props: React.ComponentProps<typeof MarkerComponent>) {
  const implementation = useContext(MapImplementation);
  return implementation ? <implementation.Marker {...props} /> : null;
}

export function Polyline(props: React.ComponentProps<typeof PolylineComponent>) {
  const implementation = useContext(MapImplementation);
  return implementation ? <implementation.Polyline {...props} /> : null;
}

export default MapView;
