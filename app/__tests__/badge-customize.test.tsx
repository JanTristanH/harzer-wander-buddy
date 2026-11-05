import React from 'react';
import { Alert } from 'react-native';
import ProfileEdit from '@/app/profile/edit';
import ProfileCustomize from '@/app/profile/customize';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import Customize from '@/app/profile/badges/customize';
import { saveBadgeProfile, updateCurrentUserProfile, uploadProfileImage } from '@/lib/api';
let mockBeforeRemove: ((event: any) => void) | undefined;
const mockNavigation = { addListener: jest.fn((_event, listener) => { mockBeforeRemove = listener; return () => {}; }), dispatch: jest.fn() };
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
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: any) => require('react').useEffect(callback, [callback]),
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
  uploadProfileImage: jest.fn(),
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
test('selects and uploads a photo on the same screen as the name and badge controls', async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as any);
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:/photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg' }],
    } as any);
  jest.mocked(uploadProfileImage).mockResolvedValue({ url: '/new-photo.jpg' } as any);
  render(<Customize />);
  fireEvent.press(screen.getByText('Profilbild auswählen'));
  await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText('Profilbild groß ansehen')).toBeTruthy());
  fireEvent.press(screen.getByText('Änderungen speichern'));
  await waitFor(() =>
    expect(uploadProfileImage).toHaveBeenCalledWith('token', {
      uri: 'file:/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    })
  );
  await waitFor(() =>
    expect(updateCurrentUserProfile).toHaveBeenCalledWith(
      'token',
      { name: 'Alex', picture: '/new-photo.jpg' },
      'user-1'
    )
  );
  expect(mockRouter.push).not.toHaveBeenCalled();
});
test('selects a badge through a plus slot and saves inline name with real profile and badge APIs', async () => {
  render(<Customize />);
  fireEvent.changeText(await screen.findByLabelText('Anzeigename'), 'Bergfreundin');
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
    { name: 'Bergfreundin', picture: mockProfile.picture },
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
  (saveBadgeProfile as jest.Mock).mockRejectedValue(new Error('Server nicht erreichbar'));
  render(<Customize />);
  fireEvent.changeText(await screen.findByLabelText('Anzeigename'), 'Bergfreundin');
  fireEvent.press(screen.getByText('Änderungen speichern'));
  await screen.findByText(/Name und Profilbild gespeichert.*noch nicht gespeichert/);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

test('denied photo permission keeps the current picture and never opens the library', async () => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: false } as any);
  render(<Customize />);
  fireEvent.press(screen.getByLabelText('Profilbild ändern'));
  await screen.findByText('Bitte erlaube den Zugriff auf deine Fotos.');
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  expect(uploadProfileImage).not.toHaveBeenCalled();
});

test('failed uploads keep the draft and allow retry without saving badges prematurely', async () => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as any);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:/retry.jpg' }] } as any);
  jest.mocked(uploadProfileImage).mockRejectedValueOnce(new Error('Upload fehlgeschlagen')).mockResolvedValue({ url: '/retry.jpg' } as any);
  render(<Customize />);
  fireEvent.press(screen.getByText('Profilbild auswählen'));
  await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
  fireEvent.changeText(screen.getByLabelText('Anzeigename'), 'Neuer Name');
  fireEvent.press(screen.getByText('Änderungen speichern'));
  await screen.findByText('Upload fehlgeschlagen');
  expect(screen.getByLabelText('Anzeigename').props.value).toBe('Neuer Name');
  expect(saveBadgeProfile).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Änderungen speichern'));
  await waitFor(() => expect(saveBadgeProfile).toHaveBeenCalled());
  expect(uploadProfileImage).toHaveBeenCalledTimes(2);
});

test('all profile editing entry points use the same screen', () => {
  expect(ProfileEdit).toBe(Customize);
  expect(ProfileCustomize).toBe(Customize);
});


test('warns before discarding changes from the unified editor', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<Customize />);
  fireEvent.changeText(await screen.findByLabelText('Anzeigename'), 'Ungespeichert');
  const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
  mockBeforeRemove!(event);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  buttons.find(button => button.text === 'Verwerfen')!.onPress!();
  expect(mockNavigation.dispatch).toHaveBeenCalledWith(event.data.action);
  alert.mockRestore();
});
