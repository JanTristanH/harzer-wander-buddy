import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TourGpxExport } from '@/components/tour-gpx-export';
import { shareGpx } from '@/lib/share-gpx';
jest.mock('@/lib/share-gpx', () => ({ shareGpx: jest.fn().mockResolvedValue(undefined) }));
test('reports missing geometry and never shares a misleading file', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const view = render(<TourGpxExport name="Harz" path={[]} />);
  fireEvent.press(view.getByLabelText('Tour als GPX exportieren'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('GPX-Export nicht möglich', expect.any(String)));
  expect(shareGpx).not.toHaveBeenCalled();
  alert.mockRestore();
});
test('disabled while saved route is being refreshed', () => {
  const view = render(<TourGpxExport name="Harz" path={[]} disabled />);
  expect(view.getByRole('button').props.accessibilityState.disabled).toBe(true);
});
