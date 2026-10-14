import { createCssMapMarkerHtml, normalizeWebMarkerLabel, WEB_MAP_MARKER_CSS } from '@/lib/web-map-marker';

describe('web map marker HTML', () => {
  it('renders a lightweight CSS marker without SVG filters', () => {
    const html = createCssMapMarkerHtml({ color: '#2e6b4b', label: '121', size: 48 });

    expect(html).toContain('hwb-css-marker');
    expect(html).toContain('121');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<filter');
    expect(html).not.toContain('feDropShadow');
  });

  it('escapes marker labels and rejects injected colors', () => {
    const html = createCssMapMarkerHtml({
      color: 'red;position:fixed',
      label: '<x>',
      size: 48,
    });

    expect(html).toContain('--hwb-marker-color:#2e6b4b');
    expect(html).toContain('&lt;X&gt;');
    expect(html).not.toContain('position:fixed');
  });

  it('normalizes labels and marks compact location dots', () => {
    expect(normalizeWebMarkerLabel(' abcd5 ')).toBe('ABCD');
    expect(createCssMapMarkerHtml({ color: '#2f7dd7', size: 14 })).toContain(
      'hwb-css-marker--compact'
    );
  });

  it.each([
    ['P', 17.2],
    ['12', 21.8],
    ['121', 27],
    ['ABCD', 35],
  ])('matches the native badge width for label %s', (label, expectedWidth) => {
    const html = createCssMapMarkerHtml({ color: '#2e6b4b', label, size: 48 });

    expect(html).toContain(`--hwb-marker-badge-width:${expectedWidth}px`);
  });
  it('scales the contour and badge together for smaller markers', () => {
    const html = createCssMapMarkerHtml({ color: '#2e6b4b', label: '121', size: 24 });
    expect(html).toContain(`--hwb-marker-scale-x:${24 / 56}`);
    expect(html).toContain(`--hwb-marker-scale-y:${26 / 60}`);
    expect(WEB_MAP_MARKER_CSS).toContain('border-radius: 50%');
    expect(WEB_MAP_MARKER_CSS).toContain('height: var(--hwb-marker-badge-width)');
    expect(WEB_MAP_MARKER_CSS).toContain('mask-image: url("data:image/svg+xml,');
  });

  it('fits wide letters inside the circle without shrinking numeric labels', () => {
    const wide = createCssMapMarkerHtml({ color: '#2e6b4b', label: 'WWW', size: 48 });
    const numeric = createCssMapMarkerHtml({ color: '#2e6b4b', label: '222', size: 48 });
    expect(wide).toContain('--hwb-marker-font-size:8.58px');
    expect(numeric).toContain('--hwb-marker-font-size:14px');
  });
});
