import React from 'react';
import { Image as NativeImage } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { manipulateAsync } from 'expo-image-manipulator';
import { ProfilePhotoEditor } from '@/components/profile-photo-editor';
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
const photo = { uri: 'blob:photo', fileName: 'photo.png', mimeType: 'image/png' };
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(NativeImage, 'getSize').mockImplementation((_uri, success) => {
    success?.(1200, 800);
    return Promise.resolve({ width: 1200, height: 800 });
  });
  jest.mocked(manipulateAsync).mockResolvedValue({ uri: 'cropped.jpg', width: 640, height: 640 });
});
afterEach(() => jest.restoreAllMocks());
test('exports the visible square after zooming rather than uploading the original', async () => {
  const onApply = jest.fn();
  render(<ProfilePhotoEditor image={photo} onCancel={jest.fn()} onApply={onApply} />);
  await waitFor(() => expect(screen.getByText('Ausschnitt übernehmen')).toBeEnabled());
  fireEvent.press(screen.getByLabelText('Mehr zoomen'));
  fireEvent.press(screen.getByText('Ausschnitt übernehmen'));
  await waitFor(() =>
    expect(onApply).toHaveBeenCalledWith({
      uri: 'cropped.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    })
  );
  expect(manipulateAsync).toHaveBeenCalledWith(
    'blob:photo',
    [{ crop: { originX: 280, originY: 80, width: 640, height: 640 } }],
    { format: 'jpeg', compress: 0.95 }
  );
});
test('canceling does not replace the previous image or process an upload', () => {
  const onCancel = jest.fn();
  const onApply = jest.fn();
  render(<ProfilePhotoEditor image={photo} onCancel={onCancel} onApply={onApply} />);
  fireEvent.press(screen.getByText('Abbrechen'));
  expect(onCancel).toHaveBeenCalled();
  expect(onApply).not.toHaveBeenCalled();
  expect(manipulateAsync).not.toHaveBeenCalled();
});
