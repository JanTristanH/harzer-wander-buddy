import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { triggerHaptic } from '@/lib/haptics-preferences';

jest.mock('@react-navigation/elements', () => {
  const { Pressable } = require('react-native');
  return { PlatformPressable: (props: any) => <Pressable {...props} /> };
});

jest.mock('@/lib/haptics-preferences', () => ({
  triggerHaptic: jest.fn(() => Promise.resolve()),
}));

const mockTriggerHaptic = triggerHaptic as jest.MockedFunction<typeof triggerHaptic>;

describe('HapticTab user interaction', () => {
  beforeEach(() => {
    mockTriggerHaptic.mockClear();
  });

  it('triggers tab-change haptics and forwards the press for an unselected tab', () => {
    const onPress = jest.fn();
    render(
      <HapticTab
        accessibilityState={{ selected: false }}
        onPress={onPress as any}>
        <Text>Karte</Text>
      </HapticTab>
    );

    fireEvent.press(screen.getByText('Karte'));

    expect(mockTriggerHaptic).toHaveBeenCalledWith('tabChange');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('skips haptics when the tab is already selected', () => {
    const onPress = jest.fn();
    render(
      <HapticTab
        accessibilityState={{ selected: true }}
        onPress={onPress as any}>
        <Text>Profil</Text>
      </HapticTab>
    );

    fireEvent.press(screen.getByText('Profil'));

    expect(mockTriggerHaptic).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
