import { shareGpx } from '@/lib/share-gpx';
import { Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
  File: jest.fn().mockImplementation((_directory, name) => ({
    uri: `file:///cache/export/${name}`, write: jest.fn(), delete: jest.fn(),
  })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => jest.clearAllMocks());

test('preserves filename, MIME type and readable file after the share sheet resolves', async () => {
  await shareGpx('Harz.gpx', '<gpx/>');
  const file = (File as unknown as jest.Mock).mock.results[0].value;
  expect(file.write).toHaveBeenCalledWith('<gpx/>');
  expect(Sharing.shareAsync).toHaveBeenCalledWith(file.uri, expect.objectContaining({
    mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx',
  }));
  expect(file.delete).not.toHaveBeenCalled();
  await shareGpx('Harz.gpx', '<gpx/>');
  const calls = (Directory as unknown as jest.Mock).mock.calls;
  expect(calls[0][2]).not.toBe(calls[1][2]);
});

test('does not create files when sharing is unavailable', async () => {
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
  await expect(shareGpx('Harz.gpx', '<gpx/>')).rejects.toThrow();
  expect(File).not.toHaveBeenCalled();
});
