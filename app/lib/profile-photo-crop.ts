export type PhotoDimensions = { width: number; height: number };
export type PhotoPosition = { x: number; y: number; zoom: number };
export function photoCropLayout(image: PhotoDimensions, side: number, position: PhotoPosition) {
  const zoom = Math.max(1, Math.min(4, position.zoom));
  const scale = Math.max(side / image.width, side / image.height) * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  const x = Math.max(-(width - side) / 2, Math.min((width - side) / 2, position.x));
  const y = Math.max(-(height - side) / 2, Math.min((height - side) / 2, position.y));
  return { width, height, x, y, scale, zoom };
}
export function profilePhotoCrop(image: PhotoDimensions, side: number, position: PhotoPosition) {
  const layout = photoCropLayout(image, side, position);
  const size = Math.max(1, Math.min(image.width, image.height, Math.round(side / layout.scale)));
  return {
    originX: Math.max(
      0,
      Math.min(image.width - size, Math.round((image.width - size) / 2 - layout.x / layout.scale))
    ),
    originY: Math.max(
      0,
      Math.min(image.height - size, Math.round((image.height - size) / 2 - layout.y / layout.scale))
    ),
    width: size,
    height: size,
  };
}
