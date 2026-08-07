import { createCssMapMarkerHtml, normalizeWebMarkerLabel } from '@/lib/web-map-marker';

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
});
