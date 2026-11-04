const MIN_HEIGHT = 240;
const MAX_HEIGHT = 320;

/** Show more of taller images, while keeping very wide images and placeholders compact. */
export function getStampHeroHeight(
  viewportWidth: number,
  viewportHeight: number,
  image?: { width: number; height: number },
) {
  if (!image || !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) {
    return MIN_HEIGHT;
  }
  return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, viewportHeight * 0.42, viewportWidth * image.height / image.width));
}
