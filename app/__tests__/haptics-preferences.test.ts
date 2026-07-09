import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import {
  DEFAULT_HAPTIC_STRENGTH,
  getCachedHapticStrength,
  setHapticStrengthPreference,
  triggerHaptic,
} from '@/lib/haptics-preferences';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const selectionAsync = Haptics.selectionAsync as jest.Mock;
const impactAsync = Haptics.impactAsync as jest.Mock;
const notificationAsync = Haptics.notificationAsync as jest.Mock;

describe('Haptic preference interaction', () => {
  beforeEach(() => {
    selectionAsync.mockClear();
    impactAsync.mockClear();
    notificationAsync.mockClear();
  });

  it('defaults to the documented medium strength', () => {
    expect(DEFAULT_HAPTIC_STRENGTH).toBe('medium');
  });

  it('persists a chosen strength and exposes it via the cache', async () => {
    await setHapticStrengthPreference('strong');

    expect(getCachedHapticStrength()).toBe('strong');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@hwb:haptic-strength', 'strong');
  });

  it('produces no feedback when the user turned haptics off', async () => {
    await setHapticStrengthPreference('off');

    await triggerHaptic('poiAdded');
    await triggerHaptic('tabChange');

    expect(selectionAsync).not.toHaveBeenCalled();
    expect(impactAsync).not.toHaveBeenCalled();
    expect(notificationAsync).not.toHaveBeenCalled();
  });

  it('uses a medium impact when stamping a POI at medium strength', async () => {
    await setHapticStrengthPreference('medium');

    await triggerHaptic('poiAdded');

    expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('uses a success notification when stamping a POI at strong strength', async () => {
    await setHapticStrengthPreference('strong');

    await triggerHaptic('poiAdded');

    expect(notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('uses a light selection for tab changes at light strength', async () => {
    await setHapticStrengthPreference('light');

    await triggerHaptic('tabChange');

    expect(selectionAsync).toHaveBeenCalledTimes(1);
  });
});
