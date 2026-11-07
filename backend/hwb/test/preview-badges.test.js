const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildDemoBadgeData } = require('../util/seedPreviewBadges');
const { buildAlbum, sanitizeSelection } = require('../srv/badge-catalog');
const stamps = Array.from({ length: 60 }, (_, i) => ({
  ID: `stamp-${i + 1}`,
  number: String(i + 1),
  name: `Stamp ${i + 1}`,
}));

test('demo badge selections are earned from matching distinct visits', () => {
  const users = [8, 16, 24, 50].map((targetCount) => ({ id: `demo-${targetCount}`, targetCount }));
  const result = buildDemoBadgeData(stamps, users);
  assert.deepEqual(
    result.profiles.map((profile) => profile.frame),
    ['bronze', 'silver', 'gold', 'king']
  );
  for (const profile of result.profiles) {
    const visits = result.visits.filter((visit) => visit.createdBy === profile.userId);
    const album = buildAlbum(stamps, visits);
    const selected = {
      featured: JSON.parse(profile.featured),
      title: profile.title,
      frame: profile.frame,
    };
    assert.deepEqual(sanitizeSelection(selected, album), selected);
    assert.ok(selected.featured.length > 0);
  }
});
test('seeding twice keeps visits and achievements unchanged', () => {
  const users = [{ id: 'demo', targetCount: 16 }];
  const first = buildDemoBadgeData(stamps, users);
  const second = buildDemoBadgeData(stamps, users, first.visits);
  assert.equal(second.visits.length, 0);
  assert.deepEqual(second.profiles, first.profiles);
});
test('an incomplete fixture never receives an unearned badge', () => {
  const result = buildDemoBadgeData(stamps.slice(0, 3), [{ id: 'demo', targetCount: 50 }]);
  assert.equal(result.profiles[0].featured, '[]');
  assert.equal(result.profiles[0].frame, '');
});
