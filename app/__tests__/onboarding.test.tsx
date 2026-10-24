import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import OnboardingScreen from '@/app/onboarding';
import { updateCurrentUserProfile, uploadProfileImage } from '@/lib/api';

const mockReplace = jest.fn();
const mockComplete = jest.fn();
const mockSetProfile = jest.fn();
const mockQueryClient = { prefetchQuery: jest.fn().mockResolvedValue(undefined), setQueryData: jest.fn(), invalidateQueries: jest.fn() };
const mockClaims = { sub: 'test-user', name: 'Alex', picture: 'https://example.com/old.png' };
const mockProfile = { id: 'test-user', name: 'Alex', picture: mockClaims.picture };
const mockAuth = { accessToken: 'token', isAuthenticated: true, canPerformWrites: true,
  currentUserProfile: mockProfile, completeOnboarding: mockComplete, setCurrentUserProfile: mockSetProfile, logout: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }), Redirect: () => null, Link: ({ children }: { children: React.ReactNode }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: 'asset:/avatar.png' }) } }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn(), requestForegroundPermissionsAsync: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('@/lib/auth', () => ({ useIdTokenClaims: () => mockClaims, useAuth: () => mockAuth }));
jest.mock('@/lib/api', () => ({ updateCurrentUserProfile: jest.fn(), uploadProfileImage: jest.fn(), searchUsers: jest.fn(), createFriendRequest: jest.fn() }));
jest.mock('@/lib/queries', () => ({ queryKeys: { stampsOverview: () => ['stamps'], profileOverview: () => ['profile'] }, fetchStampsOverviewData: jest.fn() }));
jest.mock('@/lib/images', () => ({ buildAuthenticatedImageSource: (uri: string) => ({ uri }) }));
jest.mock('@/lib/config', () => ({ appConfig: { authMode: 'basic' } }));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.canPerformWrites = true;
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, status: 'undetermined' });
  (updateCurrentUserProfile as jest.Mock).mockImplementation(async (_token, updates) => updates);
  (uploadProfileImage as jest.Mock).mockResolvedValue({ url: 'https://example.com/new.png' });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

async function advance(label = 'Weiter') {
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: label })); });
}
async function openAvatarStep() {
  render(<OnboardingScreen />);
  await advance('Los geht’s');
  await advance();
}

test('guides through separate steps, validates the name and retains edits when going back', async () => {
  render(<OnboardingScreen />);
  expect(screen.queryByLabelText('Dein Anzeigename')).toBeNull();
  await advance('Los geht’s');
  fireEvent.changeText(screen.getByLabelText('Dein Anzeigename'), '');
  expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Dein Anzeigename'), 'Wanderalex');
  await advance();
  expect(updateCurrentUserProfile).toHaveBeenCalledWith('token', { name: 'Wanderalex', picture: mockClaims.picture });
  fireEvent.press(screen.getByRole('button', { name: 'Vorheriger Schritt' }));
  expect(screen.getByLabelText('Dein Anzeigename').props.value).toBe('Wanderalex');
});

test('none explicitly removes a provider picture without uploading', async () => {
  await openAvatarStep();
  expect(screen.getAllByRole('radio')).toHaveLength(4);
  fireEvent.press(screen.getByRole('radio', { name: 'Kein Avatar' }));
  expect(screen.getByRole('radio', { name: 'Kein Avatar' })).toBeChecked();
  await advance();
  expect(updateCurrentUserProfile).toHaveBeenCalledWith('token', { name: 'Alex', picture: '' });
  expect(uploadProfileImage).not.toHaveBeenCalled();
});

test('uploads the chosen default avatar and preserves the selection on back navigation', async () => {
  await openAvatarStep();
  fireEvent.press(screen.getByRole('radio', { name: 'Fuchs' }));
  await advance();
  expect(uploadProfileImage).toHaveBeenCalledWith('token', { uri: 'asset:/avatar.png', fileName: 'avatar-fox.png', mimeType: 'image/png' });
  expect(updateCurrentUserProfile).toHaveBeenCalledWith('token', { name: 'Alex', picture: 'https://example.com/new.png' });
  fireEvent.press(screen.getByRole('button', { name: 'Vorheriger Schritt' }));
  expect(screen.getByRole('radio', { name: 'Fuchs' })).toBeChecked();
});

test('failed upload retains the draft and prevents advancing, then allows retry', async () => {
  await openAvatarStep();
  (uploadProfileImage as jest.Mock).mockRejectedValueOnce(new Error('Upload fehlgeschlagen'));
  fireEvent.press(screen.getByRole('radio', { name: 'Luchs' }));
  await advance();
  expect(screen.getByRole('header', { name: 'Welcher Buddy bist du?' })).toBeTruthy();
  expect(screen.getByText('Upload fehlgeschlagen')).toBeTruthy();
  expect(mockComplete).not.toHaveBeenCalled();
  await advance();
  expect(screen.getByRole('header', { name: 'Das nächste Ziel ist ganz nah.' })).toBeTruthy();
});

test('optional steps can be skipped and completion only happens at the end', async () => {
  await openAvatarStep();
  await advance();
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  await advance('Ohne Standort weiter');
  expect(mockComplete).not.toHaveBeenCalled();
  await advance('Zu den Stempelstellen');
  expect(mockComplete).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});

test('denied location permission still allows completing onboarding', async () => {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, status: 'denied' });
  await openAvatarStep();
  await advance();
  await advance('Standort aktivieren');
  await advance('Ohne Standort weiter');
  await advance('Zu den Stempelstellen');
  expect(mockComplete).toHaveBeenCalledTimes(1);
});
