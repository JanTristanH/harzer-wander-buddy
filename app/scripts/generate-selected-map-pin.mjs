import { readFile, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

// The exact same contour and colors drive the web SVG/Canvas and native bitmaps.
const pin = JSON.parse(await readFile(new URL('../lib/selected-map-pin.json', import.meta.url), 'utf8'));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pin.width}" height="${pin.height}" viewBox="0 0 ${pin.width} ${pin.height}"><path fill="${pin.color}" d="${pin.path}"/><circle fill="${pin.dotColor}" cx="${pin.dotX}" cy="${pin.dotY}" r="${pin.dotRadius}"/></svg>`;
for (const scale of [1, 2, 3]) {
  const suffix = scale === 1 ? '' : `@${scale}x`;
  const output = new URL(`../assets/images/map/selected-pin${suffix}.png`, import.meta.url);
  const image = await sharp(Buffer.from(svg)).resize(pin.width * scale, pin.height * scale).png().toBuffer();
  await writeFile(output, image);
}
