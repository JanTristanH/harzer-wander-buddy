import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareGpx(fileName: string, content: string) {
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('Dateien können auf diesem Gerät nicht geteilt werden.');
  }
  const file = new File(Paths.cache, fileName);
  file.write(content);
  // Keep the file until the share sheet finishes reading it.
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx', dialogTitle: 'Tour als GPX exportieren',
    });
  } finally {
    if (file.exists) file.delete();
  }
}
