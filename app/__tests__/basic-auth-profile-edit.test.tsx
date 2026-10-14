import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';

import { fetchCurrentUserProfile } from '@/lib/api';
import { AuthProvider, useAuth, useIdTokenClaims } from '@/lib/auth';

jest.mock('expo-auth-session', () => ({}));
jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-web-browser', () => ({}));
jest.mock('@/lib/config', () => ({ appConfig: { authMode: 'basic' } }));
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOffline: false }) }));
jest.mock('@/lib/api', () => ({ fetchCurrentUserProfile: jest.fn(), updateCurrentUserOnboardingCompleted: jest.fn() }));
jest.mock('@/lib/query-client', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/lib/query-persistence', () => ({ clearPersistedQueryCache: async () => {} }));

// The editor load effect must not restart or overwrite an unsaved name when
// reloading the profile updates the surrounding authentication context.
function ProfileEditorProbe() {
  const { accessToken, login, logout, preloadCurrentUserProfile, setCurrentUserProfile } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const [name, setName] = useState('');
  useEffect(() => {
    if (!accessToken) return;
    void preloadCurrentUserProfile().then((profile) => setName(profile?.name ?? '')).catch(() => {});
  }, [accessToken, claims?.sub, logout, preloadCurrentUserProfile]);
  return <>
    <Pressable onPress={() => void login('user1@hwb.de', 'test-password')}><Text>Login</Text></Pressable>
    <TextInput accessibilityLabel="Anzeigename" value={name} onChangeText={setName} />
    <Pressable onPress={() => setCurrentUserProfile({ id: 'user1@hwb.de', name: 'Background refresh' })}>
      <Text>Refresh profile</Text>
    </Pressable>
  </>;
}

test('Basic profile loads once and keeps unsaved edits during auth profile updates', async () => {
  const fetchProfile = fetchCurrentUserProfile as jest.Mock;
  // Bound a faulty load loop so the regression fails instead of running forever.
  fetchProfile.mockImplementation(async () => {
    if (fetchProfile.mock.calls.length > 4) throw new Error('Repeated profile reload');
    return { id: 'user1@hwb.de', name: 'Test user' };
  });
  render(<AuthProvider><ProfileEditorProbe /></AuthProvider>);
  await act(async () => { fireEvent.press(screen.getByText('Login')); });
  await waitFor(() => expect(screen.getByLabelText('Anzeigename').props.value).toBe('Test user'));
  expect(fetchProfile).toHaveBeenCalledTimes(2);
  fireEvent.changeText(screen.getByLabelText('Anzeigename'), 'Unsaved edit');
  await act(async () => { fireEvent.press(screen.getByText('Refresh profile')); });
  expect(screen.getByLabelText('Anzeigename').props.value).toBe('Unsaved edit');
  expect(fetchProfile).toHaveBeenCalledTimes(2);
});
