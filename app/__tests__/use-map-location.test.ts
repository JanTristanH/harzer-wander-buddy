import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useMapLocation } from '@/hooks/use-map-location';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
const getPermission = Location.getForegroundPermissionsAsync as jest.Mock;
const requestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const getPosition = Location.getCurrentPositionAsync as jest.Mock;
const denied = { granted: false, status: 'denied', canAskAgain: true };
const granted = { granted: true, status: 'granted', canAskAgain: true };
const coordinate = { latitude: 51.7544, longitude: 10.6182 };

beforeEach(() => {
  jest.resetAllMocks();
  getPermission.mockResolvedValue(denied);
  requestPermission.mockResolvedValue(granted);
  getPosition.mockResolvedValue({ coords: coordinate });
});

it.each(['denied', 'undetermined'])('never prompts automatically for %s, including after reopening', async (status) => {
  getPermission.mockResolvedValue({ ...denied, status });
  const first = renderHook(useMapLocation);
  await waitFor(() => expect(getPermission).toHaveBeenCalledTimes(1));
  first.unmount();
  renderHook(useMapLocation);
  await waitFor(() => expect(getPermission).toHaveBeenCalledTimes(2));
  expect(requestPermission).not.toHaveBeenCalled();
  expect(getPosition).not.toHaveBeenCalled();
});

it('enables tracking automatically only with an existing grant', async () => {
  getPermission.mockResolvedValue(granted);
  const { result } = renderHook(useMapLocation);
  await waitFor(() => expect(result.current.locationState).toBe('granted'));
  expect(requestPermission).not.toHaveBeenCalled();
});

it('requests permission on locate and returns the current position for centering', async () => {
  const { result } = renderHook(useMapLocation);
  await waitFor(() => expect(result.current.locationState).toBe('denied'));
  await act(async () => { expect(await result.current.locateMe()).toEqual(coordinate); });
  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(result.current.userLocation).toEqual(coordinate);
  expect(result.current.locationState).toBe('granted');
});

it('does not prompt again for an existing grant', async () => {
  getPermission.mockResolvedValue(granted);
  const { result } = renderHook(useMapLocation);
  await act(async () => { await result.current.locateMe(); });
  expect(requestPermission).not.toHaveBeenCalled();
  expect(getPosition).toHaveBeenCalledTimes(1);
});

it.each([true, false])('leaves tracking off after denial (canAskAgain: %s)', async (canAskAgain) => {
  getPermission.mockResolvedValue({ ...denied, canAskAgain });
  requestPermission.mockResolvedValue(denied);
  const { result } = renderHook(useMapLocation);
  await act(async () => { expect(await result.current.locateMe()).toBeNull(); });
  expect(requestPermission).toHaveBeenCalledTimes(canAskAgain ? 1 : 0);
  expect(getPosition).not.toHaveBeenCalled();
  expect(result.current.locationState).toBe('denied');
});

it('deduplicates concurrent presses and permits an explicit retry after denial', async () => {
  let resolvePermission!: (value: typeof denied) => void;
  requestPermission.mockReturnValueOnce(new Promise((resolve) => { resolvePermission = resolve; }));
  const { result } = renderHook(useMapLocation);
  await waitFor(() => expect(result.current.locationState).toBe('denied'));
  let pending!: ReturnType<typeof result.current.locateMe>;
  await act(async () => { pending = result.current.locateMe(); });
  await act(async () => { expect(await result.current.locateMe()).toBeNull(); });
  expect(requestPermission).toHaveBeenCalledTimes(1);
  await act(async () => { resolvePermission(denied); await pending; });
  await act(async () => { await result.current.locateMe(); });
  expect(requestPermission).toHaveBeenCalledTimes(2);
  expect(result.current.locationState).toBe('granted');
});

it('settles a failed position lookup and allows retry', async () => {
  getPermission.mockResolvedValue(granted);
  getPosition.mockRejectedValueOnce(new Error('timeout'));
  const { result } = renderHook(useMapLocation);
  await act(async () => { expect(await result.current.locateMe()).toBeNull(); });
  expect(result.current.locationState).toBe('denied');
  await act(async () => { expect(await result.current.locateMe()).toEqual(coordinate); });
});

it('does not request permission if unmounted during the permission check', async () => {
  let resolvePermission!: (value: typeof denied) => void;
  getPermission.mockReturnValue(new Promise((resolve) => { resolvePermission = resolve; }));
  const view = renderHook(useMapLocation);
  let pending!: ReturnType<typeof view.result.current.locateMe>;
  act(() => { pending = view.result.current.locateMe(); });
  view.unmount();
  await act(async () => { resolvePermission(denied); await pending; });
  expect(requestPermission).not.toHaveBeenCalled();
  expect(getPosition).not.toHaveBeenCalled();
});

it('does not let a late mount check overwrite a successful explicit request', async () => {
  let resolveInitialPermission!: (value: typeof denied) => void;
  getPermission
    .mockReturnValueOnce(new Promise((resolve) => { resolveInitialPermission = resolve; }))
    .mockResolvedValue(granted);
  const { result } = renderHook(useMapLocation);
  await act(async () => { await result.current.locateMe(); });
  await act(async () => { resolveInitialPermission(denied); });
  expect(result.current.locationState).toBe('granted');
  expect(result.current.userLocation).toEqual(coordinate);
});
