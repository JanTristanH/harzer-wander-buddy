import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TourGpxExport } from '@/components/tour-gpx-export';
import { shareGpx } from '@/lib/share-gpx';
jest.mock('@/lib/share-gpx', () => ({ shareGpx: jest.fn().mockResolvedValue(undefined) }));
beforeEach(() => jest.clearAllMocks());
test('reports missing geometry and never shares a misleading file', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const view = render(<TourGpxExport name="Harz" path={[]} />);
  fireEvent.press(view.getByLabelText('Tour als GPX exportieren'));
  fireEvent.press(view.getByLabelText('Verbundene Route'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('GPX-Export nicht möglich', expect.any(String)));
  expect(shareGpx).not.toHaveBeenCalled();
  alert.mockRestore();
});
test('asks before exporting and allows cancellation without sharing', () => {
  const view = render(<TourGpxExport name="Harz" path={[]} />);
  fireEvent.press(view.getByLabelText('Tour als GPX exportieren'));
  expect(view.getByLabelText('Verbundene Route')).toBeTruthy();
  expect(view.getByLabelText('Einzelne Etappen')).toBeTruthy();
  expect(shareGpx).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('GPX-Export abbrechen'));
  expect(view.getByLabelText('Tour als GPX exportieren')).toBeTruthy();
  expect(shareGpx).not.toHaveBeenCalled();
});
test.each([['Verbundene Route', 1], ['Einzelne Etappen', 2]])('exports the chosen format: %s', async (label, tracks) => {
  const path = [1, 2].map(rank => ({ rank, tour_ID: 'tour', travelTime_ID: String(rank), travelTime: {
    ID: String(rank), positionString: '10;51;0;11;52;0', durationSeconds: null,
    distanceMeters: null, elevationGain: null, elevationLoss: null,
  } }));
  const onExported = jest.fn();
  const view = render(<TourGpxExport name="Harz" path={path} onExported={onExported} />);
  fireEvent.press(view.getByLabelText('Tour als GPX exportieren'));
  fireEvent.press(view.getByLabelText(String(label)));
  await waitFor(() => expect(onExported).toHaveBeenCalledTimes(1));
  expect((shareGpx as jest.Mock).mock.calls[0][1].match(/<trk>/g)).toHaveLength(Number(tracks));
});
test('disabled while saved route is being refreshed', () => {
  const view = render(<TourGpxExport name="Harz" path={[]} disabled />);
  expect(view.getByRole('button').props.accessibilityState.disabled).toBe(true);
});
