import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text, StyleSheet, PanResponder } from 'react-native';
import { ProfileImageViewer } from '@/components/profile-image-viewer';
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ accessToken: 'token' }) }));
jest.mock('@/lib/images', () => ({
  buildAuthenticatedImageSource: (uri: string, token: string) => ({
    uri,
    headers: { Authorization: `Bearer ${token}` },
  }),
}));
test('opens a clean photo view, pinches to zoom and resets on reopening', () => {
  jest.spyOn(PanResponder, 'create').mockImplementation(
    (config) =>
      ({
        panHandlers: {
          onResponderGrant: (event: any) => config.onPanResponderGrant?.(event, {} as any),
          onResponderRelease: (event: any) => config.onPanResponderRelease?.(event, { dx: 0, dy: 0 } as any),
        onResponderMove: (event: any) =>
            config.onPanResponderMove?.(event, { dx: 0, dy: 0 } as any),
        },
      }) as any
  );
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
  expect(screen.queryByLabelText('Vergrößern')).toBeNull();
  expect(screen.queryByLabelText('Verkleinern')).toBeNull();
  expect(screen.queryByLabelText('Zoom zurücksetzen')).toBeNull();
  fireEvent(screen.getByTestId('profile-image-gestures'), 'responderGrant', {
    nativeEvent: {
      touches: [
        { pageX: 0, pageY: 0 },
        { pageX: 100, pageY: 0 },
      ],
    },
  });
  fireEvent(screen.getByTestId('profile-image-gestures'), 'responderMove', {
    nativeEvent: {
      touches: [
        { pageX: 0, pageY: 0 },
        { pageX: 200, pageY: 0 },
      ],
    },
  });
  expect(
    StyleSheet.flatten(screen.getByTestId('full-profile-image').props.style).transform
  ).toContainEqual({ scale: 2 });
  fireEvent.press(screen.getByLabelText('Bild schließen'));
  expect(screen.queryByTestId('full-profile-image')).toBeNull();
  fireEvent.press(screen.getByLabelText('Profilbild groß ansehen'));
  expect(
    StyleSheet.flatten(screen.getByTestId('full-profile-image').props.style).transform
  ).toContainEqual({ scale: 1 });
  fireEvent(screen.getByTestId('profile-image-gestures'), 'responderGrant', { nativeEvent: { touches: [{ pageX: 0, pageY: 0 }] } });
  fireEvent(screen.getByTestId('profile-image-gestures'), 'responderRelease', {});
  fireEvent(screen.getByTestId('profile-image-gestures'), 'responderRelease', {});
  expect(StyleSheet.flatten(screen.getByTestId('full-profile-image').props.style).transform).toContainEqual({ scale: 2 });
  jest.restoreAllMocks();
});
test('does not open a missing photo', () => {
  render(
    <ProfileImageViewer>
      <Text>Placeholder</Text>
    </ProfileImageViewer>
  );
  expect(screen.getByLabelText('Profilbild groß ansehen')).toBeDisabled();
});
