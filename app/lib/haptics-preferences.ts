import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticStrength = 'off' | 'light' | 'medium' | 'strong';
export type HapticEvent = 'poiAdded' | 'tabChange';

const HAPTIC_STRENGTH_STORAGE_KEY = '@hwb:haptic-strength';
export const DEFAULT_HAPTIC_STRENGTH: HapticStrength = 'medium';

let cachedStrength: HapticStrength = DEFAULT_HAPTIC_STRENGTH;
let hasLoadedStrength = false;
let loadStrengthPromise: Promise<HapticStrength> | null = null;

function isHapticStrength(value: string): value is HapticStrength {
  return value === 'off' || value === 'light' || value === 'medium' || value === 'strong';
}

export function getCachedHapticStrength() {
  return cachedStrength;
}

export async function loadHapticStrengthPreference() {
  if (hasLoadedStrength) {
    return cachedStrength;
  }

  if (loadStrengthPromise) {
    return loadStrengthPromise;
  }

  loadStrengthPromise = (async () => {
    try {
      const rawValue = await AsyncStorage.getItem(HAPTIC_STRENGTH_STORAGE_KEY);
      if (rawValue && isHapticStrength(rawValue)) {
        cachedStrength = rawValue;
      } else {
        cachedStrength = DEFAULT_HAPTIC_STRENGTH;
      }
    } catch {
      cachedStrength = DEFAULT_HAPTIC_STRENGTH;
    } finally {
      hasLoadedStrength = true;
      loadStrengthPromise = null;
    }

    return cachedStrength;
  })();

  return loadStrengthPromise;
}

export async function setHapticStrengthPreference(strength: HapticStrength) {
  cachedStrength = strength;
  hasLoadedStrength = true;

  try {
    await AsyncStorage.setItem(HAPTIC_STRENGTH_STORAGE_KEY, strength);
  } catch {
    // Preference is still cached in memory for this session.
  }
}

async function safeSelectionAsync() {
  if (typeof Haptics.selectionAsync !== 'function') {
    return;
  }

  await Haptics.selectionAsync();
}

async function safeImpactAsync(style: Haptics.ImpactFeedbackStyle) {
  if (typeof Haptics.impactAsync !== 'function') {
    return;
  }

  await Haptics.impactAsync(style);
}

async function safeNotificationAsync(type: Haptics.NotificationFeedbackType) {
  if (typeof Haptics.notificationAsync !== 'function') {
    return;
  }

  await Haptics.notificationAsync(type);
}

export async function triggerHaptic(event: HapticEvent) {
  if (Platform.OS === 'web') {
    return;
  }

  const strength = await loadHapticStrengthPreference();

  if (strength === 'off') {
    return;
  }

  if (event === 'poiAdded') {
    if (strength === 'light') {
      await safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (strength === 'medium') {
      await safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    await safeNotificationAsync(Haptics.NotificationFeedbackType.Success);
    return;
  }

  if (strength === 'light') {
    await safeSelectionAsync();
    return;
  }

  if (strength === 'medium') {
    await safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }

  await safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
