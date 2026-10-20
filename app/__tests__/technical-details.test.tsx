import { fireEvent, render, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React from 'react';
import { Platform } from 'react-native';

import { TechnicalDetails } from '@/components/profile/technical-details';
import { useServerInfoQuery } from '@/lib/queries';

jest.mock('@/lib/queries', () => ({ useServerInfoQuery: jest.fn() }));
const mockServerInfoQuery = useServerInfoQuery as jest.Mock;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    nativeAppVersion: '1.5.2',
    nativeBuildVersion: '42',
    expoConfig: { version: '1.5.3' },
  },
}));
jest.mock('expo-updates', () => ({
  channel: 'preview',
  runtimeVersion: '1.5.2',
  updateId: '67c9f34e-e701-45dc-a29e-5a686409d204',
  isEnabled: true,
  isEmbeddedLaunch: false,
}));

const originalPlatform = Platform.OS;
beforeEach(() => {
  mockServerInfoQuery.mockReturnValue({
    data: { version: '2.8.0', serverTime: '2026-10-15T10:30:45Z' },
    isFetching: false,
    isError: false,
  });
  Object.assign(Platform, { OS: 'ios' });
  Object.assign(Constants, {
    nativeAppVersion: '1.5.2',
    nativeBuildVersion: '42',
  });
  Object.assign(Updates, {
    channel: 'preview',
    runtimeVersion: '1.5.2',
    updateId: '67c9f34e-e701-45dc-a29e-5a686409d204',
    isEnabled: true,
    isEmbeddedLaunch: false,
  });
});
afterAll(() => {
  Object.assign(Platform, { OS: originalPlatform });
});

function expand() {
  fireEvent.press(screen.getByRole('button', { name: /Technische Details/ }));
}

it('reveals the running native build and update, then collapses again', () => {
  render(<TechnicalDetails />);
  expect(screen.queryByText('Update-Channel')).toBeNull();
  expand();
  expect(screen.getByRole('button', { expanded: true })).toBeTruthy();
  expect(screen.getByText('42')).toBeTruthy();
  expect(screen.getAllByText('1.5.2')).toHaveLength(2);
  expect(screen.queryByText('1.5.3')).toBeNull();
  expect(screen.getByText('preview')).toBeTruthy();
  expect(screen.getByText(Updates.updateId!)).toBeTruthy();
  expect(screen.getByText('Expo Update')).toBeTruthy();
  expand();
  expect(screen.queryByText('Update-Channel')).toBeNull();
});

it('identifies an embedded update', () => {
  Object.assign(Updates, { isEmbeddedLaunch: true });
  render(<TechnicalDetails />);
  expand();
  expect(screen.getByText('Im Build enthalten')).toBeTruthy();
});

it('handles missing update metadata in a development build', () => {
  Object.assign(Updates, {
    channel: null,
    runtimeVersion: null,
    updateId: null,
    isEnabled: false,
  });
  Object.assign(Constants, {
    nativeAppVersion: null,
    nativeBuildVersion: null,
  });
  render(<TechnicalDetails />);
  expand();
  expect(screen.getByText('1.5.3')).toBeTruthy();
  expect(screen.getByText('Kein Channel konfiguriert')).toBeTruthy();
  expect(screen.getByText('Entwicklungsmodus / Updates deaktiviert')).toBeTruthy();
});

it('does not present native Expo metadata as web update information', () => {
  Object.assign(Platform, { OS: 'web' });
  render(<TechnicalDetails />);
  expand();
  expect(screen.queryByText('42')).toBeNull();
  expect(screen.getByText('1.5.3')).toBeTruthy();
  expect(screen.queryByText('preview')).toBeNull();
  expect(screen.queryByText('Expo Update')).toBeNull();
  expect(screen.getByText('Web-App')).toBeTruthy();
  expect(screen.getAllByText('In der Web-App nicht verfügbar').length).toBeGreaterThan(0);
});

it('loads server metadata only while expanded and formats the server timestamp', () => {
  render(<TechnicalDetails />);
  expect(mockServerInfoQuery).toHaveBeenLastCalledWith(false);
  expand();
  expect(mockServerInfoQuery).toHaveBeenLastCalledWith(true);
  expect(screen.getByText('2.8.0')).toBeTruthy();
  expect(screen.getByText(new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium', timeStyle: 'long',
  }).format(new Date('2026-10-15T10:30:45Z')))).toBeTruthy();
});

it('handles loading and failed server requests without hiding the app metadata', () => {
  mockServerInfoQuery.mockReturnValue({ isFetching: true });
  const { rerender } = render(<TechnicalDetails />);
  expand();
  expect(screen.getAllByText('Wird geladen…')).toHaveLength(2);
  mockServerInfoQuery.mockReturnValue({ isFetching: false, isError: true });
  rerender(<TechnicalDetails />);
  expect(screen.getAllByText('Nicht verfügbar')).toHaveLength(2);
  expect(screen.getByText('42')).toBeTruthy();
});
