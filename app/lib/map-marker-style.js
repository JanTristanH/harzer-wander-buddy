// Shared by the native PNG generator and the web DivIcon renderer.
const geometry = require('./map-marker-style.json');

function resolveMapMarkerLabelStyle(label) {
  const style = geometry.labelStyles[Math.min(4, Math.max(1, label.length)) - 1];
  // Reserve room at the narrower top/bottom of the badge, including wide letters.
  const estimatedTextWidth = Array.from(label).reduce((width, character) => {
    const factor = /[MW@%]/.test(character) ? 1 : /[A-Z]/.test(character) ? 0.75 : 0.6;
    return width + factor;
  }, 0);
  // Keep text sizing independent of changes to the circle radius.
  const availableWidth = style.textWidth;
  const fontSize = Math.min(style.fontSize, availableWidth / (estimatedTextWidth || 1));
  return { ...style, fontSize: Number(fontSize.toFixed(2)) };
}

module.exports = { geometry, resolveMapMarkerLabelStyle };
