import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareGpx(fileName: string, content: string) {
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('Dateien können auf diesem Gerät nicht geteilt werden.');
  }
  // Receivers may open the URI after Android has already closed the share sheet.
  // Keep each export in its own cache directory; the OS can reclaim it later.
  const directory = new Directory(Paths.cache, 'gpx-exports', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  directory.create({ intermediates: true });
  const file = new File(directory, fileName);
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx', dialogTitle: 'Tour als GPX exportieren',
  });
}
