import type { TourPathEntry } from './api';

export type RouteCoordinate = { latitude: number; longitude: number };

/** OData uses the UI5 position format: longitude;latitude;altitude triples. */
export function parseRoutePositionString(positionString?: string): RouteCoordinate[] {
  if (!positionString?.trim()) return [];

  const values = positionString.trim().replace(/;$/, '').split(';');
  if (values.length % 3 !== 0) return [];

  const coordinates: RouteCoordinate[] = [];
  for (let index = 0; index < values.length; index += 3) {
    const triple = values.slice(index, index + 3);
    if (triple.some((value) => !value.trim() || !Number.isFinite(Number(value)))) return [];
    const [longitude, latitude] = triple.map(Number);
    if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return [];
    coordinates.push({ latitude, longitude });
  }
  return coordinates.length > 1 ? coordinates : [];
}

export function buildTourRouteSegments(path: TourPathEntry[], poiIds: string[]) {
  const sortedPath = [...path].sort((left, right) => left.rank - right.rank);
  const segments: TourRouteSegment[] = [];
  for (let index = 1; index < poiIds.length; index += 1) {
    // While autosave calculates a changed tour, only show legs still in the draft.
    const leg = sortedPath.find(
      ({ travelTime }) =>
        travelTime?.fromPoi?.toLowerCase() === poiIds[index - 1].toLowerCase() &&
        travelTime?.toPoi?.toLowerCase() === poiIds[index].toLowerCase()
    );
    const coordinates = parseRoutePositionString(leg?.travelTime?.positionString);
    if (coordinates.length > 1) {
      const mode = leg?.travelTime?.travelMode?.trim().toLowerCase() ?? '';
      segments.push({
        coordinates,
        mode: /drive|car|motor|vehicle|auto/.test(mode) ? 'drive' : 'walk',
      });
    }
  }
  return segments;
}

export type TourRouteSegment = {
  coordinates: RouteCoordinate[];
  mode: 'walk' | 'drive';
};

export const TOUR_ROUTE_STYLES = {
  walk: { color: '#2e6b4b', label: 'Wandern' },
  drive: { color: '#2563eb', label: 'Autofahren' },
} as const;

export type SharedRouteSection = {
  segmentIndex: number;
  edgeIndex: number;
  startFraction: number;
  endFraction: number;
};

/** Compare opposite edges in metres, independently of zoom and vertex sampling.
 * A minimum overlap and nearly parallel headings avoid treating crossings as returns.
 */
export function findSharedRouteSections(segments: TourRouteSegment[]): SharedRouteSection[] {
  const origin = segments.find((segment) => segment.coordinates.length)?.coordinates[0];
  if (!origin) return [];
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos(origin.latitude * Math.PI / 180);
  if (longitudeScale < 1) return [];
  const tolerance = 3;
  const edges = segments.flatMap((segment, segmentIndex) =>
    segment.coordinates.slice(1).map((end, edgeIndex) => {
      const start = segment.coordinates[edgeIndex];
      const x = (start.longitude - origin.longitude) * longitudeScale;
      const y = (start.latitude - origin.latitude) * latitudeScale;
      const dx = (end.longitude - start.longitude) * longitudeScale;
      const dy = (end.latitude - start.latitude) * latitudeScale;
      return { segmentIndex, edgeIndex, x, y, dx, dy, length: Math.hypot(dx, dy),
        minX: Math.min(x, x + dx), maxX: Math.max(x, x + dx),
        minY: Math.min(y, y + dy), maxY: Math.max(y, y + dy) };
    })
  ).filter((edge) => edge.length > 0).sort((a, b) => a.minX - b.minX);
  const sections: SharedRouteSection[] = [];
  for (let index = 0; index < edges.length; index += 1) {
    const a = edges[index];
    for (let next = index + 1; next < edges.length; next += 1) {
      const b = edges[next];
      // Sweep bounding boxes to skip geometrically unrelated edges.
      if (b.minX > a.maxX + tolerance) break;
      if (b.minY > a.maxY + tolerance || b.maxY < a.minY - tolerance) continue;
      if ((a.dx * b.dx + a.dy * b.dy) / (a.length * b.length) > -0.995) continue;
      const ux = a.dx / a.length;
      const uy = a.dy / a.length;
      const start = (b.x - a.x) * ux + (b.y - a.y) * uy;
      const end = start + b.dx * ux + b.dy * uy;
      const low = Math.max(0, end);
      const high = Math.min(a.length, start);
      // Allow short sampled edges, but require a meaningful fraction of each edge.
      if (high - low < Math.min(10, a.length * 0.5, b.length * 0.5)) continue;
      const offset = (b.x - a.x) * -uy + (b.y - a.y) * ux;
      const drift = b.dx * -uy + b.dy * ux;
      const bLow = (low - start) / (end - start);
      const bHigh = (high - start) / (end - start);
      if (Math.max(Math.abs(offset + drift * bLow), Math.abs(offset + drift * bHigh)) > tolerance) continue;
      sections.push({ segmentIndex: a.segmentIndex, edgeIndex: a.edgeIndex,
        startFraction: low / a.length, endFraction: high / a.length });
      sections.push({ segmentIndex: b.segmentIndex, edgeIndex: b.edgeIndex,
        startFraction: Math.max(0, bHigh), endFraction: Math.min(1, bLow) });
    }
  }
  return sections;
}

/** Chevron polylines work on both native maps and Leaflet, without marker rotation.
 * Size and spacing follow the viewport so arrows stay legible when zooming.
 */
export function buildRouteDirectionArrows(
  coordinates: RouteCoordinate[],
  latitudeDelta: number,
  mapHeight: number,
  sharedSections: SharedRouteSection[] = []
): RouteCoordinate[][] {
  if (coordinates.length < 2 || latitudeDelta <= 0 || mapHeight <= 0) return [];
  const longitudeScale = Math.cos(coordinates[0].latitude * Math.PI / 180);
  if (longitudeScale < 0.01) return [];
  const unitsPerPixel = latitudeDelta / mapHeight;
  const arm = unitsPerPixel * 9;
  const spacing = unitsPerPixel * 100;
  const edges = coordinates.slice(1).map((end, index) => {
    const start = coordinates[index];
    const dx = (end.longitude - start.longitude) * longitudeScale;
    const dy = end.latitude - start.latitude;
    return { start, dx, dy, length: Math.hypot(dx, dy) };
  });
  const total = edges.reduce((sum, edge) => sum + edge.length, 0);
  // Short legs remain readable without crowding their stop markers.
  if (total < unitsPerPixel * 40) return [];
  const count = Math.min(80, Math.max(1, Math.floor(total / spacing)));
  const arrows: RouteCoordinate[][] = [];
  let edgeIndex = 0;
  let edgeStart = 0;
  for (let index = 0; index < count; index += 1) {
    const distance = total * (index + 0.5) / count;
    while (edgeIndex < edges.length - 1 && edgeStart + edges[edgeIndex].length < distance) {
      edgeStart += edges[edgeIndex++].length;
    }
    const edge = edges[edgeIndex];
    if (!edge.length) continue;
    const fraction = (distance - edgeStart) / edge.length;
    // Leave room for the whole chevron at the boundary of a shared section.
    if (sharedSections.some((section) => section.edgeIndex === edgeIndex &&
      fraction >= section.startFraction - arm / edge.length &&
      fraction <= section.endFraction + arm / edge.length)) continue;
    const tip = {
      latitude: edge.start.latitude + edge.dy * fraction,
      longitude: edge.start.longitude + edge.dx * fraction / longitudeScale,
    };
    const ux = edge.dx / edge.length;
    const uy = edge.dy / edge.length;
    arrows.push([
      { latitude: tip.latitude - uy * arm + ux * arm * 0.7,
        longitude: tip.longitude + (-ux * arm - uy * arm * 0.7) / longitudeScale },
      tip,
      { latitude: tip.latitude - uy * arm - ux * arm * 0.7,
        longitude: tip.longitude + (-ux * arm + uy * arm * 0.7) / longitudeScale },
    ]);
  }
  return arrows;
}
