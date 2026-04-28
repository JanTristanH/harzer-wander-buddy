import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Platform } from 'react-native';

import { triggerHaptic } from '@/lib/haptics-preferences';

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPress={(ev) => {
        if (Platform.OS !== 'web' && !props.accessibilityState?.selected) {
          void triggerHaptic('tabChange').catch(() => {
            // Keep tab navigation robust when haptics are unavailable.
          });
        }
        props.onPress?.(ev);
      }}
    />
  );
}
