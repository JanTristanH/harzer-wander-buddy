/* eslint-disable no-undef */

// AsyncStorage native module is unavailable under Jest; use the official mock.
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Provide deterministic safe-area insets for components that rely on them.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    ...actual,
    useSafeAreaInsets: () => inset,
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
  };
});

// expo-image renders a heavy native component; a lightweight stub is enough.
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props) => React.createElement(View, props) };
});

// expo-linear-gradient -> simple view.
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props) => React.createElement(View, props) };
});

// Icon fonts load asynchronously and trigger act() warnings; stub the icons.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const makeIcon = () => (props) => React.createElement(Text, props, null);
  return new Proxy(
    {},
    {
      get: () => makeIcon(),
    }
  );
});
