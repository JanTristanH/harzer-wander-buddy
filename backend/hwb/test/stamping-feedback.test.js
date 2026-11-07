const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildStampingFeedback } = require('../srv/stamping-feedback');
const stamps = Array.from({ length: 8 }, (_, i) => ({ ID: `s${i}`, number: String(i + 1), name: `Ort ${i}` }));
const old = stamps.slice(0, 7).map((stamp, i) => ({ ID: `v${i}`, stamp_ID: stamp.ID, visitedAt: '2026-11-01' }));

test('one confirmed batch distinguishes repeated visits, specials and a new badge', () => {
  const allStamps = [...stamps, { ID: 'special', number: 'S1', name: 'Sonderstempel' }];
  const added = [
    { ID: 'new', stamp_ID: 's7', visitedAt: '2026-11-06' },
    { ID: 'repeat', stamp_ID: 's0', visitedAt: '2026-11-06' },
    { ID: 'special-visit', stamp_ID: 'special', visitedAt: '2026-11-06' },
  ];
  const result = buildStampingFeedback(allStamps, [...old, ...added], ['new', 'repeat', 'special-visit', 'new']);
  assert.equal(result.visitCount, 3);
  assert.equal(result.beforeCount, 7);
  assert.equal(result.afterCount, 8);
  assert.equal(result.newPlaces, 2);
  assert.equal(result.repeatCount, 1);
  assert.deepEqual(result.newBadges.map(badge => badge.id), ['bronze']);
  assert.equal(result.nextGoal.id, 'silver');
});

test('a repeated visit earns no additional unique progress or badge', () => {
  const visits = [...old, { ID: 'repeat', stamp_ID: 's0', visitedAt: '2026-11-06' }];
  const result = buildStampingFeedback(stamps, visits, ['repeat']);
  assert.equal(result.newPlaces, 0);
  assert.equal(result.repeatCount, 1);
  assert.equal(result.beforeCount, result.afterCount);
  assert.deepEqual(result.newBadges, []);
});

test('unconfirmed and unknown IDs cannot fabricate a reward', () => {
  const result = buildStampingFeedback(stamps, old, ['missing']);
  assert.equal(result.visitCount, 0);
  assert.equal(result.newPlaces, 0);
  assert.deepEqual(result.newBadges, []);
});
