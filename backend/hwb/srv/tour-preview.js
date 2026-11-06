// A small, self-contained SVG of the real route, cached on Tours. No tile API,
// credentials, or live map instances are needed for scrolling the tour list.
function createTourPreview(edges) {
  const coordinates = edges.flatMap((edge) => {
    const values = String(edge.positionString || '').split(';');
    const points = [];
    for (let i = 0; i + 1 < values.length; i += 3) {
      if (!values[i].trim() || !values[i + 1].trim()) continue;
      const x = Number(values[i]),
        y = Number(values[i + 1]);
      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Math.abs(x) <= 180 &&
        Math.abs(y) <= 90
      )
        points.push([x, y]);
    }
    return points;
  });
  if (coordinates.length < 2) return null;
  const xs = coordinates.map((point) => point[0]),
    ys = coordinates.map((point) => point[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const cos = Math.max(0.1, Math.cos((((minY + maxY) / 2) * Math.PI) / 180));
  const scale = Math.min(
    244 / Math.max((maxX - minX) * cos, 0.00001),
    172 / Math.max(maxY - minY, 0.00001)
  );
  const project = ([x, y]) => [
    160 + (x - (minX + maxX) / 2) * cos * scale,
    120 - (y - (minY + maxY) / 2) * scale,
  ];
  const stride = Math.max(1, Math.ceil(coordinates.length / 180));
  const sampled = coordinates.filter(
    (_, i) => i % stride === 0 || i === coordinates.length - 1
  );
  const points = sampled
    .map(project)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const [x, y] = project(coordinates[0]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#d4dfd0" stroke-width="1"/></pattern></defs><rect width="320" height="240" fill="#eaf0e6"/><rect width="320" height="240" fill="url(#grid)"/><polyline points="${points}" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points}" fill="none" stroke="#2e6b4b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="#2e6b4b" stroke="#fff" stroke-width="3"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#fff">P</text></svg>`;
}
module.exports = { createTourPreview };
