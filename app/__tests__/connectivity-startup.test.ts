import { onlineManager, QueryClient } from '@tanstack/react-query';
import { configureQueryOnlineManager } from '@/lib/connectivity';

let mockListener: (state: unknown) => void;
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: (listener: (state: unknown) => void) => { mockListener = listener; return () => {}; } },
}));

test('queries wait until Internet reachability is positively known', async () => {
  onlineManager.setOnline(true);
  configureQueryOnlineManager();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.mount();
  const request = jest.fn(async () => 'loaded');
  const result = client.fetchQuery({ queryKey: ['startup'], queryFn: request });
  mockListener({ isConnected: null, isInternetReachable: null });
  await new Promise(resolve => setImmediate(resolve));
  expect(request).not.toHaveBeenCalled();
  mockListener({ isConnected: true, isInternetReachable: null });
  await new Promise(resolve => setImmediate(resolve));
  expect(request).not.toHaveBeenCalled();
  mockListener({ isConnected: true, isInternetReachable: true });
  await expect(result).resolves.toBe('loaded');
  expect(request).toHaveBeenCalledTimes(1);
  client.unmount(); client.clear(); onlineManager.setOnline(true);
});
