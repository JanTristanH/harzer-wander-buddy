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

/** Chevron polylines work on both native maps and Leaflet, without marker rotation.
 * Size and spacing follow the viewport so arrows stay legible when zooming.
 */
export function buildRouteDirectionArrows(
  coordinates: RouteCoordinate[],
  latitudeDelta: number,
  mapHeight: number
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
