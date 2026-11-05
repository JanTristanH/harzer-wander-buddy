import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';
import { ProfileImageViewer } from '@/components/profile-image-viewer';
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ accessToken: 'token' }) }));
jest.mock('@/lib/images', () => ({
  buildAuthenticatedImageSource: (uri: string, token: string) => ({
    uri,
    headers: { Authorization: `Bearer ${token}` },
  }),
}));
test('opens the full authenticated photo, zooms, resets and closes', () => {
  render(
    <ProfileImageViewer uri="/photo.jpg">
      <Text>Avatar</Text>
    </ProfileImageViewer>
  );
  fireEvent.press(screen.getByLabelText('Profilbild groß ansehen'));
  expect(screen.getByTestId('full-profile-image').props.source).toEqual({
    uri: '/photo.jpg',
    headers: { Authorization: 'Bearer token' },
  });
  fireEvent.press(screen.getByLabelText('Vergrößern'));
  expect(
    StyleSheet.flatten(screen.getByTestId('full-profile-image').props.style).transform
  ).toContainEqual({ scale: 1.5 });
  fireEvent.press(screen.getByLabelText('Zoom zurücksetzen'));
  expect(
    StyleSheet.flatten(screen.getByTestId('full-profile-image').props.style).transform
  ).toContainEqual({ scale: 1 });
  fireEvent.press(screen.getByLabelText('Bild schließen'));
  expect(screen.queryByTestId('full-profile-image')).toBeNull();
});
test('does not open a missing photo', () => {
  render(
    <ProfileImageViewer>
      <Text>Placeholder</Text>
    </ProfileImageViewer>
  );
  expect(screen.getByLabelText('Profilbild groß ansehen')).toBeDisabled();
});
