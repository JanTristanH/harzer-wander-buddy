export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapViewportRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export const MAP_VIEWPORT_PADDING_RATIO = 0.25;

function longitudeDistance(left: number, right: number) {
  const directDistance = Math.abs(left - right) % 360;
  return Math.min(directDistance, 360 - directDistance);
}

export function areMapCoordinatesEqual(
  left: MapCoordinate | null,
  right: MapCoordinate,
  epsilon = 0.000001
) {
  if (!left) {
    return false;
  }

  return (
    Math.abs(left.latitude - right.latitude) <= epsilon &&
    longitudeDistance(left.longitude, right.longitude) <= epsilon
  );
}

export function isCoordinateInPaddedRegion(
  coordinate: MapCoordinate,
  region: MapViewportRegion,
  paddingRatio = MAP_VIEWPORT_PADDING_RATIO
) {
  const normalizedPadding = Number.isFinite(paddingRatio)
    ? Math.max(0, paddingRatio)
    : MAP_VIEWPORT_PADDING_RATIO;
  const latitudeRadius = Math.max(0, region.latitudeDelta) * (0.5 + normalizedPadding);
  const longitudeRadius = Math.max(0, region.longitudeDelta) * (0.5 + normalizedPadding);

  return (
    Math.abs(coordinate.latitude - region.latitude) <= latitudeRadius &&
    longitudeDistance(coordinate.longitude, region.longitude) <= longitudeRadius
  );
}
