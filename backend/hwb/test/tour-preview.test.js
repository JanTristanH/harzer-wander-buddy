const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createTourPreview } = require('../srv/tour-preview');

test('route previews only contain validated finite geometry and remain compact', () => {
  assert.equal(createTourPreview([{ positionString: 'NaN;invalid;0;' }]), null);
  assert.equal(createTourPreview([]), null);
  const svg = createTourPreview([
    { positionString: '10;51;0;11;52;0;10;51;0;999;999;0;' },
  ]);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('polyline'));
  assert.ok(!svg.includes('NaN'));
  assert.ok(!svg.includes('999'));
  assert.ok(
    !svg.includes('http://') ||
      svg.includes('xmlns="http://www.w3.org/2000/svg"')
  );
  assert.ok(svg.length < 10000);
});
