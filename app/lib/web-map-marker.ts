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
  const labelClass = label && label.length >= 4 ? ' hwb-css-marker--wide-label' : '';

  return `<span aria-hidden="true" class="hwb-css-marker${compactClass}${labelClass}" style="--hwb-marker-color:${color}"><span class="hwb-css-marker__label">${
    label ? escapeHtmlText(label) : ''
  }</span></span>`;
}
