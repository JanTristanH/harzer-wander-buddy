// Global Jest setup, executed after the test framework is installed.
// `@testing-library/react-native` registers its matchers automatically from v12.4+,
// so we only add mocks for native modules that are not handled by the jest-expo preset.
import '@testing-library/react-native';

// expo-router is not auto-mocked by jest-expo. Provide a lightweight mock so that
// screens depending on navigation can be rendered in isolation.
jest.mock('expo-router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
  };

  return {
    __esModule: true,
    router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
    usePathname: () => '/',
    useSegments: () => [],
    Redirect: () => null,
    Link: ({ children }: { children?: unknown }) => children ?? null,
    Stack: Object.assign(() => null, { Screen: () => null }),
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

// Silence the native animation helper warnings that React Native emits in JSDOM/node.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), {
  virtual: true,
});
