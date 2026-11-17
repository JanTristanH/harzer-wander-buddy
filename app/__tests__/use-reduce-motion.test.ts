import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from '@/hooks/use-reduce-motion';

describe('system reduced-motion preference', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stays static until the preference resolves, then follows changes', async () => {
    let change: (enabled: boolean) => void = () => {};
    const remove = jest.fn();
    (jest.spyOn(AccessibilityInfo, 'addEventListener') as unknown as jest.SpyInstance<{ remove: () => void }, [string, (enabled: boolean) => void]>).mockImplementation((_, listener) => {
      change = listener;
      return { remove };
    });
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { result, unmount } = renderHook(useReduceMotion);
    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
    act(() => change(true));
    expect(result.current).toBe(true);
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('does not let an older asynchronous read override a new system preference', async () => {
    let resolveRead: (value: boolean) => void = () => {};
    let change: (enabled: boolean) => void = () => {};
    (jest.spyOn(AccessibilityInfo, 'addEventListener') as unknown as jest.SpyInstance<{ remove: () => void }, [string, (enabled: boolean) => void]>).mockImplementation((_, listener) => {
      change = listener;
      return { remove: jest.fn() };
    });
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve;
    }));
    const { result } = renderHook(useReduceMotion);
    act(() => change(true));
    await act(async () => resolveRead(false));
    expect(result.current).toBe(true);
  });
});
