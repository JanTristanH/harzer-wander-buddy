import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

const PULL_RESISTANCE = 0.45;
const MAX_PULL = 160;
const REFRESH_PULL = 90;

/** iOS supplies elastic scroll offsets; Android and web need a resisted pull gesture. */
export function useStretchyHeader(height: number, onRefresh: () => void, refreshing: boolean) {
  const usesNativeBounce = Platform.OS === 'ios';
  const scrollY = useRef(new Animated.Value(0)).current;
  const pull = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const startedAtTop = useRef(false);
  const pullDistance = useRef(0);
  const refreshRef = useRef(onRefresh);
  const refreshingRef = useRef(refreshing);
  refreshRef.current = onRefresh;
  refreshingRef.current = refreshing;

  useEffect(() => () => pull.stopAnimation(), [pull]);

  const release = useCallback((shouldRefresh: boolean) => {
    const distance = pullDistance.current;
    pullDistance.current = 0;
    startedAtTop.current = false;
    Animated.spring(pull, {
      toValue: 0,
      damping: 20,
      stiffness: 180,
      mass: 1,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
    if (shouldRefresh && distance >= REFRESH_PULL && !refreshingRef.current) {
      refreshRef.current();
    }
  }, [pull]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => {
      startedAtTop.current = scrollOffset.current <= 0 && event.nativeEvent.touches.length === 1;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (event, gesture) =>
      !usesNativeBounce && startedAtTop.current && scrollOffset.current <= 0 &&
      event.nativeEvent.touches.length === 1 && gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx) * 1.5,
    onPanResponderGrant: () => pull.stopAnimation(),
    onPanResponderMove: (_event, gesture) => {
      const distance = Math.min(MAX_PULL, Math.max(0, gesture.dy * PULL_RESISTANCE));
      pullDistance.current = distance;
      pull.setValue(distance);
    },
    onPanResponderRelease: () => release(true),
    onPanResponderTerminate: () => release(false),
    onPanResponderTerminationRequest: () => false,
  }), [pull, release, usesNativeBounce]);

  const onScroll = useMemo(() => usesNativeBounce
    ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })
    : (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
    }, [scrollY, usesNativeBounce]);

  const stretchOffset = usesNativeBounce ? Animated.multiply(scrollY, -1) : pull;
  // Grow around the image's center while keeping its bottom attached to the content.
  const backgroundStyle = {
    transform: [
      { translateY: stretchOffset.interpolate({ inputRange: [0, height], outputRange: [0, -height / 2], extrapolateLeft: 'clamp' as const }) },
      { scale: stretchOffset.interpolate({ inputRange: [0, height], outputRange: [1, 2], extrapolateLeft: 'clamp' as const }) },
    ],
  };

  return {
    usesNativeBounce,
    panHandlers: usesNativeBounce ? {} : panResponder.panHandlers,
    onScroll,
    contentStyle: usesNativeBounce ? undefined : { transform: [{ translateY: pull }] },
    backgroundStyle,
  };
}
