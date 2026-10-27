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
  const segments: RouteCoordinate[][] = [];
  for (let index = 1; index < poiIds.length; index += 1) {
    // While autosave calculates a changed tour, only show legs still in the draft.
    const leg = sortedPath.find(
      ({ travelTime }) =>
        travelTime?.fromPoi?.toLowerCase() === poiIds[index - 1].toLowerCase() &&
        travelTime?.toPoi?.toLowerCase() === poiIds[index].toLowerCase()
    );
    const coordinates = parseRoutePositionString(leg?.travelTime?.positionString);
    if (coordinates.length > 1) segments.push(coordinates);
  }
  return segments;
}
