import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { PreviewDiagnostics } from '@/components/profile/preview-diagnostics';

let mockEnabled = true;
const mockRead = jest.fn();
const mockClear = jest.fn();
jest.mock('@/lib/preview-diagnostics', () => ({
  get isPreviewBuild() { return mockEnabled; },
  readPreviewLogs: () => mockRead(), clearPreviewLogs: () => mockClear(),
  previewBuildDetails: () => ({ pr: '110', sha: 'test-commit', backend: 'https://preview.example', platform: 'android', osVersion: '36', appVersion: '1.8', mapsConfigured: false }),
}));
beforeEach(() => {
  mockEnabled = true;
  mockRead.mockResolvedValue([{ time: '2026-11-04T12:00:00Z', event: 'map.blocked_missing_key', detail: '', level: 'info', sha: 'test-commit' }]);
  mockClear.mockResolvedValue(undefined);
});

it('shows build information and saved events, shares them and clears them on request', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const screen = render(<PreviewDiagnostics />);
  fireEvent.press(screen.getByText('Preview-Protokoll'));
  await waitFor(() => expect(screen.getByText('map.blocked_missing_key')).toBeTruthy());
  expect(screen.getByText(/Google Maps im Build: Key fehlt/)).toBeTruthy();
  fireEvent.press(screen.getByText('Teilen'));
  await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('map.blocked_missing_key') })));
  fireEvent.press(screen.getByText('Logs löschen'));
  await waitFor(() => expect(screen.getByText('Noch keine Protokolleinträge.')).toBeTruthy());
  expect(mockClear).toHaveBeenCalledTimes(1);
  share.mockRestore();
});

it('adds no diagnostic UI to ordinary builds', () => {
  mockEnabled = false;
  const screen = render(<PreviewDiagnostics />);
  expect(screen.queryByText('Preview-Protokoll')).toBeNull();
});

it('bounds shared text while retaining build metadata and the most recent events', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  mockRead.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ time: 'time', event: `event-${i}`, detail: 'x'.repeat(2000), level: 'error', sha: 'test-commit' })));
  const screen = render(<PreviewDiagnostics />);
  fireEvent.press(screen.getByText('Preview-Protokoll'));
  await waitFor(() => expect(screen.getByText('event-99')).toBeTruthy());
  fireEvent.press(screen.getByText('Teilen'));
  await waitFor(() => expect(share).toHaveBeenCalled());
  const message = share.mock.calls[0][0].message!;
  expect(message.length).toBeLessThan(50000);
  expect(message).toContain('test-commit');
  expect(message).toContain('event-99');
  share.mockRestore();
});
