import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type StampingSuccessToastProps = {
  message: string;
  onHide: () => void;
  topOffset: number;
  visible: boolean;
  durationMs?: number;
};

export function StampingSuccessToast({
  message,
  onHide,
  topOffset,
  visible,
  durationMs = 2400,
}: StampingSuccessToastProps) {
  const progress = useRef(new Animated.Value(1)).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      progress.stopAnimation();
      progress.setValue(1);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      return;
    }

    progress.setValue(1);
    Animated.timing(progress, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: false,
    }).start();

    hideTimeoutRef.current = setTimeout(() => {
      hideTimeoutRef.current = null;
      onHide();
    }, durationMs);

    return () => {
      progress.stopAnimation();
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [durationMs, onHide, progress, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.container, { top: topOffset }]}>
      <View style={styles.toast}>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.timerTrack}>
          <Animated.View
            style={[
              styles.timerBar,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 40,
  },
  toast: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: 'rgba(36, 56, 41, 0.96)',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  message: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  timerTrack: {
    marginTop: 8,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 243, 238, 0.24)',
    overflow: 'hidden',
  },
  timerBar: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f5f3ee',
  },
});
