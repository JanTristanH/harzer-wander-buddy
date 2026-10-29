import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import Customize from '@/app/profile/badges/customize';
import { saveBadgeProfile, updateCurrentUserProfile } from '@/lib/api';
const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockClient = {
  invalidateQueries: jest.fn().mockResolvedValue(undefined),
};
const mockProfile = {
  id: 'user-1',
  name: 'Alex',
  picture: '/avatar.jpg',
  roles: ['User'],
};
let mockAuth: any;
const mockSetProfile = jest.fn();
const entry = (id: string, name: string, unlocked = true) => ({
  id,
  name,
  frame: id,
  unlocked,
  category: 'Leistungsabzeichen',
  icon: 'feather',
  condition: 'Stempel sammeln',
  acquiredAt: null,
  progress: [{ label: 'Gesamtstempel', current: 32, total: 222 }],
  required: [],
  titles: [],
});
const mockAlbum = {
  entries: [
    entry('gold', 'Gold'),
    entry('silver', 'Silber'),
    entry('king', 'Wanderkönig', false),
    entry('emperor', 'Wanderkaiser', false),
  ],
  selection: { featured: ['gold'], title: 'wanderer', frame: 'gold' },
  selectionChanged: false,
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: any) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClient,
}));
jest.mock('@/lib/badges', () => ({
  useBadgeAlbum: () => ({ data: mockAlbum, error: null, refetch: jest.fn() }),
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => mockAuth,
  useIdTokenClaims: () => ({ sub: 'user-1' }),
}));
jest.mock('@/lib/queries', () => ({
  useAuthorizedRequest: () => (fn: any) => fn('token'),
  queryKeys: { profileOverview: (id: string) => ['profile', id] },
}));
jest.mock('@/lib/api', () => ({
  saveBadgeProfile: jest.fn(),
  updateCurrentUserProfile: jest.fn(),
}));
jest.mock('@/components/auth-guard', () => ({
  AuthGuard: ({ children }: any) => children,
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/components/badge-artwork', () => ({ BadgeArtwork: () => null }));
jest.mock('@/components/badge-ui', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    badgeStyles: {},
    BadgePage: ({ children, footer }: any) => (
      <View>
        {children}
        {footer}
      </View>
    ),
    BadgeButton: ({ children, onPress, disabled }: any) => (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled }}
        onPress={onPress}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
    BadgeLoadState: () => null,
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = {
    currentUserProfile: mockProfile,
    setCurrentUserProfile: mockSetProfile,
    canPerformWrites: true,
    isOffline: false,
  };
  (saveBadgeProfile as jest.Mock).mockResolvedValue(mockAlbum);
  (updateCurrentUserProfile as jest.Mock).mockResolvedValue({
    name: 'Bergfreundin',
  });
});
test('keeps the complete legacy name/photo editor reachable from the preview and explicit entry', async () => {
  render(<Customize />);
  await screen.findByLabelText('Anzeigename');
  fireEvent.press(screen.getByText('Name und Profilbild bearbeiten'));
  expect(mockRouter.push).toHaveBeenCalledWith('/profile/edit');
  fireEvent.press(screen.getByLabelText('Name und Profilbild bearbeiten'));
  expect(mockRouter.push).toHaveBeenCalledTimes(2);
});
test('selects a badge through a plus slot and saves inline name with real profile and badge APIs', async () => {
  render(<Customize />);
  fireEvent.changeText(
    await screen.findByLabelText('Anzeigename'),
    'Bergfreundin'
  );
  fireEvent.press(screen.getByLabelText('Profilabzeichen 2 hinzufügen'));
  fireEvent.press(screen.getByLabelText('Silber'));
  fireEvent.press(screen.getByText('Änderungen speichern'));
  await waitFor(() =>
    expect(saveBadgeProfile).toHaveBeenCalledWith('token', {
      featured: ['gold', 'silver'],
      title: 'wanderer',
      frame: 'gold',
    })
  );
  expect(updateCurrentUserProfile).toHaveBeenCalledWith(
    'token',
    { name: 'Bergfreundin' },
    'user-1'
  );
  expect(mockSetProfile).toHaveBeenCalledWith({
    ...mockProfile,
    name: 'Bergfreundin',
  });
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile');
});
test('disables offline saving and slot edits', async () => {
  mockAuth = { ...mockAuth, isOffline: true, canPerformWrites: false };
  render(<Customize />);
  await screen.findByLabelText('Anzeigename');
  fireEvent.press(screen.getByText('Änderungen speichern'));
  expect(saveBadgeProfile).not.toHaveBeenCalled();
  expect(updateCurrentUserProfile).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Profilabzeichen 2 hinzufügen')).toBeDisabled();
});
test('preserves an unsaved inline name during background profile refresh', async () => {
  const { rerender } = render(<Customize />);
  fireEvent.changeText(await screen.findByLabelText('Anzeigename'), 'Unsaved');
  mockAuth = {
    ...mockAuth,
    currentUserProfile: { ...mockProfile, name: 'Background' },
  };
  rerender(<Customize />);
  expect(screen.getByLabelText('Anzeigename').props.value).toBe('Unsaved');
});
test('reports a partial save instead of pretending both requests succeeded', async () => {
  (saveBadgeProfile as jest.Mock).mockRejectedValue(
    new Error('Server nicht erreichbar')
  );
  render(<Customize />);
  fireEvent.changeText(
    await screen.findByLabelText('Anzeigename'),
    'Bergfreundin'
  );
  fireEvent.press(screen.getByText('Änderungen speichern'));
  await screen.findByText(/Name gespeichert.*noch nicht gespeichert/);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
