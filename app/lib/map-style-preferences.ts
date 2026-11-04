import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { defaultWebMapStyle, WEB_MAP_STYLES, type WebMapStyleId } from '@/lib/web-map-style';

export type MapStyle = WebMapStyleId;

const STORAGE_KEY = '@hwb:map-style';
export const MAP_STYLE_OPTIONS = Object.entries(WEB_MAP_STYLES).map(([key, style]) => ({
  key: key as MapStyle, label: style.label,
}));

let currentStyle: MapStyle | undefined;
let loadPromise: Promise<void> | undefined;
const listeners = new Set<() => void>();

function publish(style: MapStyle) {
  currentStyle = style;
  listeners.forEach((listener) => listener());
}

export function loadMapStylePreference() {
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value && Object.prototype.hasOwnProperty.call(WEB_MAP_STYLES, value)) publish(value as MapStyle);
    }).catch(() => {
      // Keep the default and allow a later mount to retry reading storage.
      loadPromise = undefined;
    });
  }
  return loadPromise;
}

export async function setMapStylePreference(style: MapStyle) {
  await loadMapStylePreference();
  await AsyncStorage.setItem(STORAGE_KEY, style);
  publish(style);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useMapStylePreference() {
  const style = useSyncExternalStore(subscribe, () => currentStyle ?? defaultWebMapStyle(), () => 'standard' as MapStyle);
  useEffect(() => { void loadMapStylePreference(); }, []);
  return style;
}
