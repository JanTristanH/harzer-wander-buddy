import { act, renderHook } from '@testing-library/react-native';
import { Animated, PanResponder, Platform, type GestureResponderEvent, type PanResponderGestureState, type ScrollView } from 'react-native';

import { useStretchyHeader } from '@/hooks/use-stretchy-header';

const originalPlatform = Platform.OS;
const touch = { nativeEvent: { touches: [{}] } } as GestureResponderEvent;
const gesture = (dy: number, dx = 0) => ({ dy, dx } as PanResponderGestureState);

function setup(refreshing = false) {
  const create = jest.spyOn(PanResponder, 'create');
  const onRefresh = jest.fn();
  const hook = renderHook(() => useStretchyHeader(240, onRefresh, refreshing));
  const handlers = create.mock.calls[0][0];
  const pull = (dy: number, cancelled = false) => act(() => {
    handlers.onStartShouldSetPanResponderCapture?.(touch, gesture(0));
    handlers.onPanResponderGrant?.(touch, gesture(0));
    handlers.onPanResponderMove?.(touch, gesture(dy));
    if (cancelled) handlers.onPanResponderTerminate?.(touch, gesture(dy));
    else handlers.onPanResponderRelease?.(touch, gesture(dy));
  });
  return { ...hook, handlers, onRefresh, pull };
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
});

it('only captures a downward, mostly vertical pull that begins at the top', () => {
  const { handlers, result } = setup();
  handlers.onStartShouldSetPanResponderCapture?.(touch, gesture(0));
  expect(handlers.onMoveShouldSetPanResponderCapture?.(touch, gesture(30))).toBe(true);
  expect(handlers.onMoveShouldSetPanResponderCapture?.(touch, gesture(-30))).toBe(false);
  expect(handlers.onMoveShouldSetPanResponderCapture?.(touch, gesture(10, 30))).toBe(false);
  act(() => result.current.onScroll({ nativeEvent: { contentOffset: { y: 100 } } } as never));
  handlers.onStartShouldSetPanResponderCapture?.(touch, gesture(0));
  expect(handlers.onMoveShouldSetPanResponderCapture?.(touch, gesture(30))).toBe(false);
});

it('stretches without refreshing on a short pull', () => {
  const { onRefresh, pull } = setup();
  pull(100);
  expect(onRefresh).not.toHaveBeenCalled();
});

it('suppresses the image press after pulling until a new gesture begins', () => {
  const { result, handlers, pull } = setup();
  pull(100);
  expect(result.current.didPull.current).toBe(true);
  handlers.onStartShouldSetPanResponderCapture?.(touch, gesture(0));
  expect(result.current.didPull.current).toBe(false);
});

it('refreshes once when a sufficiently long pull is released', () => {
  const { onRefresh, pull } = setup();
  pull(220);
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

it('does not refresh when a pull is cancelled or another refresh is active', () => {
  const idle = setup();
  idle.pull(220, true);
  expect(idle.onRefresh).not.toHaveBeenCalled();
  idle.unmount();
  jest.restoreAllMocks();
  const refreshing = setup(true);
  refreshing.pull(220);
  expect(refreshing.onRefresh).not.toHaveBeenCalled();
});

it('leaves the native iOS bounce and refresh gesture in control', () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const { result, handlers } = setup();
  expect(result.current.usesNativeBounce).toBe(true);
  expect(result.current.panHandlers).toEqual({});
  handlers.onStartShouldSetPanResponderCapture?.(touch, gesture(0));
  expect(handlers.onMoveShouldSetPanResponderCapture?.(touch, gesture(30))).toBe(false);
});

describe('web wheel overscroll', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  function setupWheel() {
    const hook = setup();
    let listener: (event: WheelEvent) => void;
    const node = {
      scrollTop: 0,
      clientHeight: 600,
      addEventListener: jest.fn((_type, callback) => { listener = callback; }),
      removeEventListener: jest.fn(),
    };
    const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    const spring = jest.spyOn(Animated, 'spring');
    act(() => hook.result.current.scrollRef({ getScrollableNode: () => node } as unknown as ScrollView));
    const wheel = (deltaY: number, options = {}) => {
      const event = { deltaY, deltaX: 0, deltaMode: 0, ctrlKey: false, preventDefault: jest.fn(), ...options };
      act(() => listener(event as unknown as WheelEvent));
      return event;
    };
    return { ...hook, node, setValue, spring, wheel };
  }

  it('stretches at the top and springs back after the wheel gesture without refreshing', () => {
    const { node, setValue, spring, wheel, onRefresh } = setupWheel();
    expect(node.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    expect(wheel(-100).preventDefault).toHaveBeenCalled();
    expect(setValue).toHaveBeenLastCalledWith(45);
    act(() => jest.advanceTimersByTime(100));
    wheel(-100);
    expect(setValue).toHaveBeenLastCalledWith(90);
    act(() => jest.advanceTimersByTime(100));
    expect(spring).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(40));
    expect(spring).toHaveBeenCalledTimes(1);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('preserves ordinary scrolling, horizontal gestures and pinch zoom', () => {
    const { node, setValue, wheel } = setupWheel();
    node.scrollTop = 100;
    expect(wheel(-100).preventDefault).not.toHaveBeenCalled();
    node.scrollTop = 0;
    expect(wheel(100).preventDefault).not.toHaveBeenCalled();
    expect(wheel(-100, { deltaX: 200 }).preventDefault).not.toHaveBeenCalled();
    expect(wheel(-100, { ctrlKey: true }).preventDefault).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });

  it('normalizes line and page deltas and caps the stretch', () => {
    const { setValue, wheel } = setupWheel();
    wheel(-1, { deltaMode: 1 });
    expect(setValue).toHaveBeenLastCalledWith(7.2);
    wheel(-1, { deltaMode: 2 });
    expect(setValue).toHaveBeenLastCalledWith(160);
  });

  it('releases immediately when scrolling back down', () => {
    const { spring, wheel } = setupWheel();
    wheel(-100);
    expect(wheel(20).preventDefault).not.toHaveBeenCalled();
    expect(spring).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(200));
    expect(spring).toHaveBeenCalledTimes(1);
  });

  it('removes the listener and pending release on unmount', () => {
    const { node, wheel, unmount, spring } = setupWheel();
    wheel(-100);
    unmount();
    expect(node.removeEventListener).toHaveBeenCalledWith('wheel', node.addEventListener.mock.calls[0][1]);
    act(() => jest.advanceTimersByTime(200));
    expect(spring).not.toHaveBeenCalled();
  });
});
