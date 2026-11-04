import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

const PULL_RESISTANCE = 0.45;
const MAX_PULL = 160;
const REFRESH_PULL = 90;
const WHEEL_RELEASE_DELAY = 140;
const MAX_WHEEL_HOLD = 600;

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
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    if (shouldRefresh && distance >= REFRESH_PULL && !refreshingRef.current) {
      refreshRef.current();
    }
  }, [pull]);

  useEffect(() => {
    if (!scrollNode) return;
    let wheelActive = false;
    let wheelReturning = false;
    let mousePull = false;
    let wheelHoldTimer: ReturnType<typeof setTimeout> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const clearReleaseTimer = () => {
      if (wheelReleaseTimer.current !== null) clearTimeout(wheelReleaseTimer.current);
      wheelReleaseTimer.current = null;
    };
    const returnWheel = () => {
      if (!wheelActive || wheelReturning) return;
      wheelReturning = true;
      if (wheelHoldTimer !== null) clearTimeout(wheelHoldTimer);
      wheelHoldTimer = null;
      release(false);
      // Ensure the final position even if browser animation frames are interrupted.
      settleTimer = setTimeout(() => {
        settleTimer = null;
        pull.setValue(0);
      }, 700);
    };
    const onWheel = (event: WheelEvent) => {
      // Preserve horizontal scrolling and trackpad pinch-to-zoom.
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      if (event.deltaY >= 0 || scrollNode.scrollTop > 0) {
        returnWheel();
        return;
      }
      event.preventDefault();
      clearReleaseTimer();
      wheelReleaseTimer.current = setTimeout(() => {
        wheelReleaseTimer.current = null;
        returnWheel();
        wheelActive = false;
        wheelReturning = false;
      }, WHEEL_RELEASE_DELAY);
      // Ignore the momentum tail once returning, until the wheel gesture ends.
      if (wheelReturning) return;
      if (!wheelActive) {
        wheelActive = true;
        if (settleTimer !== null) clearTimeout(settleTimer);
        settleTimer = null;
        wheelHoldTimer = setTimeout(returnWheel, MAX_WHEEL_HOLD);
      }
      pull.stopAnimation();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollNode.clientHeight : 1;
      const distance = Math.min(MAX_PULL, pullDistance.current - event.deltaY * unit * PULL_RESISTANCE);
      pullDistance.current = distance;
      pull.setValue(distance);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (wheelActive || settleTimer !== null) {
        clearReleaseTimer();
        if (wheelHoldTimer !== null) clearTimeout(wheelHoldTimer);
        if (settleTimer !== null) clearTimeout(settleTimer);
        wheelHoldTimer = null;
        settleTimer = null;
        wheelActive = false;
        wheelReturning = false;
        pullDistance.current = 0;
        pull.setValue(0);
      }
      mousePull = event.button === 0 && scrollNode.scrollTop <= 0;
    };
    const preventSelection = (event: Event) => {
      if (mousePull) event.preventDefault();
    };
    const onMouseUp = () => { mousePull = false; };
    const onBlur = () => {
      if (mousePull) release(false);
      mousePull = false;
      returnWheel();
    };
    scrollNode.addEventListener('wheel', onWheel, { passive: false });
    scrollNode.addEventListener('mousedown', onMouseDown, true);
    scrollNode.addEventListener('selectstart', preventSelection);
    scrollNode.addEventListener('dragstart', preventSelection);
    scrollNode.ownerDocument.addEventListener('mouseup', onMouseUp);
    scrollNode.ownerDocument.defaultView?.addEventListener('blur', onBlur);
    return () => {
      scrollNode.removeEventListener('wheel', onWheel);
      scrollNode.removeEventListener('mousedown', onMouseDown, true);
      scrollNode.removeEventListener('selectstart', preventSelection);
      scrollNode.removeEventListener('dragstart', preventSelection);
      scrollNode.ownerDocument.removeEventListener('mouseup', onMouseUp);
      scrollNode.ownerDocument.defaultView?.removeEventListener('blur', onBlur);
      clearReleaseTimer();
      if (wheelHoldTimer !== null) clearTimeout(wheelHoldTimer);
      if (settleTimer !== null) clearTimeout(settleTimer);
      // Ref changes must not leave the content translated with no release timer.
      pullDistance.current = 0;
      pull.setValue(0);
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

  // Android's ScrollView can intercept touches before the JS responder captures
  // them. Observe the pull alongside native scrolling in the native gesture arena.
  const androidGesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Native().enabled(Platform.OS === 'android'),
    Gesture.Pan()
      .enabled(Platform.OS === 'android')
      .runOnJS(true)
      .maxPointers(1)
      .activeOffsetY(8)
      .failOffsetY(-8)
      .failOffsetX([-12, 12])
      .onBegin(() => {
        didPull.current = false;
        startedAtTop.current = scrollOffset.current <= 0;
      })
      .onStart(() => {
        if (!startedAtTop.current) return;
        didPull.current = true;
        pull.stopAnimation();
      })
      .onUpdate((event) => {
        if (!startedAtTop.current) return;
        if (event.numberOfPointers !== 1) {
          release(false);
          return;
        }
        const distance = Math.min(MAX_PULL, Math.max(0, event.translationY * PULL_RESISTANCE));
        pullDistance.current = distance;
        pull.setValue(distance);
      })
      .onFinalize((_event, success) => {
        if (didPull.current) release(success);
      }),
  ), [pull, release]);

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
    androidGesture,
    panHandlers: Platform.OS === 'web' ? panResponder.panHandlers : {},
    onScroll,
    contentStyle: usesNativeBounce ? undefined : { transform: [{ translateY: pull }] },
    backgroundStyle,
  };
}
