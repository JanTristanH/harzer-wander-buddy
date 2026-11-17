import { Platform } from 'react-native';

/** RN Web handles Enter, but only button roles get its Space activation. */
export function checkableKeyboardProps(toggle: () => void) {
  return Platform.OS === 'web' ? {
    onKeyDown: (event: { key: string; repeat: boolean; currentTarget: { tagName?: string }; preventDefault: () => void }) => {
      if ((event.key === ' ' || event.key === 'Spacebar') && event.currentTarget.tagName !== 'BUTTON') {
        event.preventDefault();
        if (!event.repeat) toggle();
      }
    },
  } : {};
}
