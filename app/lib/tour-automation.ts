import type { HikingRouteResult, PointOfInterest } from '@/lib/api';

export type RouteCoordinate = { latitude: number; longitude: number };

export function parseRouteCoordinates(value?: string): RouteCoordinate[] {
  const values = (value || '').split(';');
  const result: RouteCoordinate[] = [];
  for (let index = 0; index + 1 < values.length; index += 3) {
    if (!values[index].trim() || !values[index + 1].trim()) continue;
    const longitude = Number(values[index]),
      latitude = Number(values[index + 1]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    )
      result.push({ latitude, longitude });
  }
  return result;
}

export function routeStops(
  route: HikingRouteResult,
  points: PointOfInterest[]
) {
  const ids = [
    route.path[0]?.travelTime?.fromPoi,
    ...route.path.map((link) => link.travelTime?.toPoi),
  ];
  const byId = new Map(points.map((point) => [point.ID, point]));
  return ids
    .map((id) => (id ? byId.get(id) : undefined))
    .filter((point): point is PointOfInterest => Boolean(point));
}

export function routeName(
  route: HikingRouteResult,
  points: PointOfInterest[],
  index = 0
) {
  const firstStamp = routeStops(route, points).find(
    (point) => point.poiType === 'stamp'
  );
  return firstStamp
    ? `Runde bei ${firstStamp.name}`
    : `Stempelrunde ${index + 1}`;
}

export function formatTourDuration(seconds: number | null) {
  if (seconds === null) return '– Min.';
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} Std.${minutes % 60 ? ` ${minutes % 60} Min.` : ''}`
    : `${minutes} Min.`;
}

export function formatTourDistance(meters: number | null) {
  return meters === null
    ? '– km'
    : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function validateTimeBudget(minutes: string) {
  const value = Number(minutes);
  return (
    /^\d+$/.test(minutes.trim()) &&
    Number.isInteger(value) &&
    value >= 15 &&
    value <= 720
  );
}
