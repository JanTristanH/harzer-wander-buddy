const sharp = require('sharp');

const SETTINGS = Object.freeze({ maxDimension: 1024, quality: 70 });
const PROFILE = `webp-v1-${SETTINGS.maxDimension}-${SETTINGS.quality}`;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff', 'image/avif'];
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

async function toBuffer(value, limit = MAX_INPUT_BYTES) {
  if (typeof value === 'string') value = Buffer.from(value, 'base64');
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    if (value.length > limit) throw Object.assign(new Error('Image exceeds 20 MiB'), { statusCode: 413 });
    return Buffer.from(value);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of value) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw Object.assign(new Error('Image exceeds 20 MiB'), { statusCode: 413 });
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function optimizeImage(content, filename) {
  const input = await toBuffer(content);
  const image = sharp(input, { limitInputPixels: 40_000_000, animated: true });
  const metadata = await image.metadata();
  // Preserve animations and multipage documents instead of silently flattening them.
  if (metadata.pages > 1) return { content: input, changed: false, before: input.length };
  const output = await image.rotate().resize({
    width: SETTINGS.maxDimension, height: SETTINGS.maxDimension,
    fit: 'inside', withoutEnlargement: true,
  }).webp({ quality: SETTINGS.quality }).toBuffer();
  if (output.length >= input.length) return { content: input, changed: false, before: input.length };
  return {
    content: output, mimeType: 'image/webp',
    filename: `${(filename || 'image').replace(/\.[^/.]+$/, '')}.webp`,
    changed: true, before: input.length,
  };
}

module.exports = { SETTINGS, PROFILE, IMAGE_TYPES, optimizeImage, toBuffer };
