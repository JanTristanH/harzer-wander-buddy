import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OfflineMapManager } from '@/components/offline-map-manager';
import type { OfflineMapPack } from '@/lib/offline-maps';
const pack: OfflineMapPack = { id: 'map-test', name: 'Brocken', bounds: [10, 51, 11, 52], bytes: 12_500_000, tileCount: 100, createdAt: '2026-10-20T00:00:00Z' };
const props = { packs: [pack], progress: null, busy: false, loading: false, error: null,
  onDownload: jest.fn(), onOpen: jest.fn(), onDelete: jest.fn(), onCancel: jest.fn() };
beforeEach(() => jest.clearAllMocks());
test('opens and removes the selected pack and starts downloads with the selected area', () => {
  const view = render(<OfflineMapManager {...props} />);
  fireEvent.press(view.getByLabelText('Brocken öffnen'));
  fireEvent.press(view.getByLabelText('Brocken löschen'));
  fireEvent.press(view.getByText('Thale & Bodetal herunterladen'));
  expect(props.onOpen).toHaveBeenCalledWith(pack);
  expect(props.onDelete).toHaveBeenCalledWith(pack);
  expect(props.onDownload).toHaveBeenCalledWith(expect.objectContaining({ name: 'Thale & Bodetal' }));
});
test('shows progress and cancellation while preventing another download', () => {
  const view = render(<OfflineMapManager {...props} busy progress={{ completed: 50, total: 100, bytes: 8_000_000 }} />);
  expect(view.getByText('50 % · 8.0 MB')).toBeTruthy();
  fireEvent.press(view.getByText('Abbrechen'));
  expect(props.onCancel).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByText('Thale & Bodetal herunterladen'));
  expect(props.onDownload).not.toHaveBeenCalled();
});
test('failed download is visible and can be retried', () => {
  const view = render(<OfflineMapManager {...props} error="Die Verbindung wurde unterbrochen." />);
  expect(view.getByRole('alert')).toBeTruthy();
  fireEvent.press(view.getByText('Brocken & Schierke herunterladen'));
  expect(props.onDownload).toHaveBeenCalledTimes(1);
});
