import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { areMapCoordinatesEqual } from '@/lib/map-viewport';

type Coordinate = { latitude: number; longitude: number };
type LocationState = 'idle' | 'loading' | 'granted' | 'denied';

export function useMapLocation() {
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const mounted = useRef(false);
  const locating = useRef(false);
  const explicitlyRequested = useRef(false);

  useEffect(() => {
    mounted.current = true;
    // Checking an existing permission must never open the system prompt.
    void Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (mounted.current && !explicitlyRequested.current) {
          setLocationState(permission.granted ? 'granted' : permission.status === 'denied' ? 'denied' : 'idle');
        }
      })
      .catch(() => {
        if (mounted.current && !explicitlyRequested.current) {
          setLocationState('denied');
        }
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleUserLocationChange = useCallback(
    (event: { nativeEvent: { coordinate?: Coordinate } }) => {
      const coordinate = event.nativeEvent.coordinate;
      if (!coordinate || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
        return;
      }
      setUserLocation((current) => areMapCoordinatesEqual(current, coordinate) ? current : coordinate);
    },
    []
  );

  const locateMe = useCallback(async (): Promise<Coordinate | null> => {
    if (locating.current) {
      return null;
    }
    locating.current = true;
    explicitlyRequested.current = true;
    setLocationState('loading');
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!mounted.current) {
        return null;
      }
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!mounted.current) {
        return null;
      }
      if (!permission.granted) {
        setUserLocation(null);
        setLocationState(permission.status === 'denied' ? 'denied' : 'idle');
        return null;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!mounted.current) {
        return null;
      }
      const coordinate = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(coordinate);
      setLocationState('granted');
      return coordinate;
    } catch {
      if (mounted.current) {
        setLocationState('denied');
      }
      return null;
    } finally {
      locating.current = false;
    }
  }, []);

  return { locationState, userLocation, handleUserLocationChange, locateMe };
}
