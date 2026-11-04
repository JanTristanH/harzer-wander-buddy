import { Platform } from 'react-native';

import { getTabBarBottomMargin } from '@/lib/tab-bar-layout';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

afterEach(() => { jest.restoreAllMocks(); });

test.each(['ios', 'android'] as const)('keeps the floating tab bar outside the bottom safe area on %s', (platform) => {
  jest.replaceProperty(Platform, 'OS', platform);
  for (const inset of [0, 16, 24, 34, 48]) {
    expect(getTabBarBottomMargin(inset)).toBeGreaterThanOrEqual(inset);
    expect(getTabBarBottomMargin(inset)).toBeGreaterThanOrEqual(20);
  }
});

test('retains Android navigation clearance and the minimum margin without an inset', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(getTabBarBottomMargin(24)).toBe(36);
  expect(getTabBarBottomMargin(0)).toBe(20);
});
