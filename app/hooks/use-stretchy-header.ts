import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';

const PULL_RESISTANCE = 0.45;
const MAX_PULL = 160;
const REFRESH_PULL = 90;
const WHEEL_RELEASE_DELAY = 140;

/** iOS supplies elastic scroll offsets; Android and web need a resisted pull gesture. */
export function useStretchyHeader(height: number, onRefresh: () => void, refreshing: boolean) {
  const usesNativeBounce = Platform.OS === 'ios';
  const scrollY = useRef(new Animated.Value(0)).current;
  const pull = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const startedAtTop = useRef(false);
  const pullDistance = useRef(0);
  const didPull = useRef(false);
  const [scrollNode, setScrollNode] = useState<HTMLElement | null>(null);
  const wheelReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useCallback((view: ScrollView | null) => {
    if (Platform.OS === 'web') setScrollNode(view?.getScrollableNode() ?? null);
  }, []);
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

  useEffect(() => {
    if (!scrollNode) return;
    const clearReleaseTimer = () => {
      if (wheelReleaseTimer.current !== null) clearTimeout(wheelReleaseTimer.current);
      wheelReleaseTimer.current = null;
    };
    const onWheel = (event: WheelEvent) => {
      // Preserve horizontal scrolling and trackpad pinch-to-zoom.
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      if (event.deltaY >= 0 || scrollNode.scrollTop > 0) {
        if (pullDistance.current > 0) {
          clearReleaseTimer();
          release(false);
        }
        return;
      }
      event.preventDefault();
      clearReleaseTimer();
      pull.stopAnimation();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollNode.clientHeight : 1;
      const distance = Math.min(MAX_PULL, pullDistance.current - event.deltaY * unit * PULL_RESISTANCE);
      pullDistance.current = distance;
      pull.setValue(distance);
      // Wheel overscroll is visual feedback; refreshing remains an explicit pull gesture.
      wheelReleaseTimer.current = setTimeout(() => {
        wheelReleaseTimer.current = null;
        release(false);
      }, WHEEL_RELEASE_DELAY);
    };
    scrollNode.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      scrollNode.removeEventListener('wheel', onWheel);
      clearReleaseTimer();
    };
  }, [pull, release, scrollNode]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => {
      didPull.current = false;
      startedAtTop.current = scrollOffset.current <= 0 && event.nativeEvent.touches.length === 1;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (event, gesture) =>
      !usesNativeBounce && startedAtTop.current && scrollOffset.current <= 0 &&
      event.nativeEvent.touches.length === 1 && gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx) * 1.5,
    onPanResponderGrant: () => {
      didPull.current = true;
      pull.stopAnimation();
    },
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
    didPull,
    scrollRef,
    panHandlers: usesNativeBounce ? {} : panResponder.panHandlers,
    onScroll,
    contentStyle: usesNativeBounce ? undefined : { transform: [{ translateY: pull }] },
    backgroundStyle,
  };
}
