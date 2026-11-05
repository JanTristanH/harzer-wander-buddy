import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Start without decorative motion until the system preference is known. */
export function useReduceMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      if (active) setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !changed) setReduced(value);
    }).catch(() => {
      // Preserve the accessible, static fallback if the platform cannot answer.
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
