import { act, renderHook } from '@testing-library/react-native';
import { PanResponder, Platform, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';

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
