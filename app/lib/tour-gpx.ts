import type { TourPathEntry } from './api';

function xml(value: string) {
  // XML 1.0 disallows these control characters, even in escaped text.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Backend stores longitude;latitude;0 triples. The zero is NOT measured elevation. */
export function parseTourGeometry(positionString?: string) {
  const values = (positionString ?? '').trim().replace(/;$/, '').split(';');
  if (values.length < 6 || values.length % 3 !== 0) {
    throw new Error('Für diese Tour fehlen vollständige Wegdaten. Bitte lade die Tour mit Internetverbindung neu.');
  }
  const points: { latitude: number; longitude: number }[] = [];
  for (let index = 0; index < values.length; index += 3) {
    const longitude = Number(values[index]);
    const latitude = Number(values[index + 1]);
    if (!values[index].trim() || !values[index + 1].trim() ||
      !Number.isFinite(longitude) || !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
      throw new Error('Die Wegdaten dieser Tour sind ungültig. Bitte lade die Tour neu.');
    }
    points.push({ latitude, longitude });
  }
  return points;
}

export function buildTourGpx(name: string, path: TourPathEntry[]) {
  if (!path.length) {
    throw new Error('Für diese Tour sind noch keine Wegdaten verfügbar.');
  }
  const tracks = [...path].sort((a, b) => a.rank - b.rank).map((entry, index) => {
    const points = parseTourGeometry(entry.travelTime?.positionString);
    const mode = entry.travelTime?.travelMode ?? '';
    const type = /drive|car|motor|vehicle|auto/i.test(mode) ? 'driving' : 'hiking';
    // Separate tracks preserve travel modes and avoid inventing links between disjoint legs.
    return `  <trk><name>${xml(name)} – Etappe ${index + 1}</name><type>${type}</type><trkseg>\n${
      points.map(point => `    <trkpt lat="${point.latitude}" lon="${point.longitude}"/>`).join('\n')
    }\n  </trkseg></trk>`;
  });
  return {
    fileName: `${name.normalize('NFC').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || 'Tour'}.gpx`,
    content: `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Harzer Wander Buddy" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${xml(name)}</name></metadata>\n${tracks.join('\n')}\n</gpx>\n`,
  };
}
