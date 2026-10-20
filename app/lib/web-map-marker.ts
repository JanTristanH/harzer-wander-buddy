import { geometry, resolveMapMarkerLabelStyle } from './map-marker-style';

const FALLBACK_MARKER_COLOR = '#2e6b4b';
const CSS_HEX_COLOR_PATTERN = /^#[0-9a-f]{3,8}$/i;

function escapeHtmlText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeWebMarkerLabel(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized ? normalized.slice(0, 4) : null;
}

function normalizeMarkerColor(value: string) {
  return CSS_HEX_COLOR_PATTERN.test(value) ? value : FALLBACK_MARKER_COLOR;
}

export function createCssMapMarkerHtml(options: {
  color: string;
  label?: string | null;
  size: number;
}) {
  const color = normalizeMarkerColor(options.color);
  const label = normalizeWebMarkerLabel(options.label ?? null);
  const compactClass = options.size <= 18 ? ' hwb-css-marker--compact' : '';
  const labelStyle = resolveMapMarkerLabelStyle(label ?? '');
  const badgeWidth = labelStyle.badgeRadius * 2;
  const height = Math.round((options.size * geometry.outputHeight) / geometry.outputWidth);

  return `<span aria-hidden="true" class="hwb-css-marker${compactClass}" style="--hwb-marker-color:${color};--hwb-marker-badge-width:${badgeWidth}px;--hwb-marker-font-size:${labelStyle.fontSize}px;--hwb-marker-scale-x:${options.size / geometry.width};--hwb-marker-scale-y:${height / geometry.height}"><span class="hwb-css-marker__label">${
    label ? escapeHtmlText(label) : ''
  }</span></span>`;
}

// Static CSS masks preserve the SVG contour and border without adding SVG nodes
// or per-marker SVG filters to Leaflet's DOM.
function pinMask(strokeWidth: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geometry.width} ${geometry.height}"><path d="${geometry.pinPath}" fill="black" stroke="black" stroke-width="${strokeWidth}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const WEB_MAP_MARKER_CSS = `
.hwb-css-marker {
  display: block;
  height: ${geometry.height}px;
  pointer-events: none;
  position: relative;
  width: ${geometry.width}px;
  transform: scale(var(--hwb-marker-scale-x), var(--hwb-marker-scale-y));
  transform-origin: top left;
  filter: drop-shadow(0 4px 2.2px rgba(20, 30, 20, 0.24));
}
.hwb-css-marker::before, .hwb-css-marker::after {
  content: "";
  inset: 0;
  position: absolute;
  mask-size: 100% 100%;
  mask-repeat: no-repeat;
}
.hwb-css-marker::before {
  background: #fff;
  mask-image: ${pinMask(2)};
}
.hwb-css-marker::after {
  background: var(--hwb-marker-color);
  mask-image: ${pinMask(0)};
}
.hwb-css-marker__label {
  align-items: center;
  background: #fff;
  border-radius: 50%;
  box-sizing: border-box;
  color: #111;
  display: flex;
  font: 700 var(--hwb-marker-font-size)/1 Arial, Helvetica, sans-serif;
  height: var(--hwb-marker-badge-width);
  justify-content: center;
  left: 50%;
  padding: 0;
  position: absolute;
  top: ${geometry.badgeY}px;
  transform: translate(-50%, -50%);
  width: var(--hwb-marker-badge-width);
  z-index: 1;
}
.hwb-css-marker--compact {
  height: 100%;
  width: 100%;
  transform: none;
  filter: none;
}
.hwb-css-marker--compact::before {
  background: var(--hwb-marker-color);
  border: 2px solid #fff;
  border-radius: 50%;
  box-sizing: border-box;
  inset: 2px;
  mask-image: none;
}
.hwb-css-marker--compact::after,
.hwb-css-marker--compact .hwb-css-marker__label {
  display: none;
}
`;
