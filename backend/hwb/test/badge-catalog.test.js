const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  buildAlbum,
  catalog,
  normalizeNumber,
  sanitizeSelection,
} = require('../srv/badge-catalog');
const stamps = Array.from({ length: 222 }, (_, index) => ({
  ID: `s${index + 1}`,
  number: String(index + 1),
  name: `Stelle ${index + 1}`,
}));
const visits = (numbers) =>
  numbers.map((number, index) => ({
    stamp_ID: `s${number}`,
    visitedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
const badge = (album, id) => album.find((entry) => entry.id === id);

test('personal unique regular numbers unlock thresholds; repeats and special stamps do not', () => {
  const allStamps = [...stamps, { ID: 'special', number: 'SX-Jungborn' }];
  const album = buildAlbum(allStamps, [
    ...visits([1, 2, 3, 4, 5, 6, 7]),
    ...visits([1, 1]),
    { stamp_ID: 'special' },
  ]);
  assert.equal(badge(album, 'bronze').unlocked, false);
  assert.equal(badge(album, 'bronze').progress[0].current, 7);
  const earned = badge(
    buildAlbum(stamps, visits([1, 2, 3, 4, 5, 6, 7, 8])),
    'bronze'
  );
  assert.equal(earned.unlocked, true);
  assert.equal(earned.acquiredAt, '2026-01-08T00:00:00.000Z');
});
test('unknown visit dates never invent acquisition dates', () => {
  const history = visits([1, 2, 3, 4, 5, 6, 7, 8]);
  delete history[0].visitedAt;
  history[0].createdAt = '2026-03-01';
  const entry = badge(buildAlbum(stamps, history), 'bronze');
  assert.equal(entry.unlocked, true);
  assert.equal(entry.acquiredAt, null);
  history.push({ ...history[0], visitedAt: '2026-04-01' });
  assert.equal(badge(buildAlbum(stamps, history), 'bronze').acquiredAt, null);
});
test('Steiger requires both 111 regular stamps and every mining site', () => {
  const mining = catalog.find((entry) => entry.id === 'steiger').required;
  assert.equal(
    badge(
      buildAlbum(stamps, visits(Array.from({ length: 111 }, (_, i) => i + 1))),
      'steiger'
    ).unlocked,
    false
  );
  const numbers = [
    ...new Set([...mining, ...Array.from({ length: 150 }, (_, i) => i + 1)]),
  ].slice(0, 111);
  const entry = badge(buildAlbum(stamps, visits(numbers)), 'steiger');
  assert.equal(entry.unlocked, true);
  assert.deepEqual(
    entry.progress.map((p) => p.current),
    [111, 23]
  );
});
test('Hexen-Stieg requires nine optional sites plus both mandatory sites', () => {
  const rule = catalog.find((entry) => entry.id === 'witch');
  assert.equal(
    badge(buildAlbum(stamps, visits(rule.pool.slice(0, 11))), 'witch').unlocked,
    false
  );
  assert.equal(
    badge(
      buildAlbum(stamps, visits([...rule.pool.slice(0, 9), 69, 140])),
      'witch'
    ).unlocked,
    true
  );
});
test('Grenzweg unlocks with 20 regular and all 3 modeled special stamps', () => {
  const rule = catalog.find((entry) => entry.id === 'border');
  const allStamps = [
    ...stamps,
    ...['SX-Zwei-Länder-Eiche', 'SX-Jungborn', 'SX-Drei-Länder-Stein'].map(
      (number, i) => ({ ID: `special${i}`, number })
    ),
  ];
  const regular = visits(rule.required.filter((n) => typeof n === 'number'));
  assert.equal(regular.length, 20);
  assert.equal(badge(buildAlbum(allStamps, regular), 'border').unlocked, false);
  const history = [
    ...regular,
    ...[0, 1, 2].map((i) => ({
      stamp_ID: `special${i}`,
      visitedAt: '2026-02-01',
    })),
  ];
  const entry = badge(buildAlbum(allStamps, history), 'border');
  assert.equal(entry.unlocked, true);
  assert.equal(entry.progress[0].total, 23);
  assert.equal(normalizeNumber('001'), '1');
});
test('princes are digital for everyone; object badges do not grant person titles', () => {
  const album = buildAlbum(
    stamps,
    visits(Array.from({ length: 150 }, (_, i) => i + 1))
  );
  assert.equal(badge(album, 'prince').unlocked, true);
  assert.match(badge(album, 'prince').note, /jedes Alter/);
  for (const id of [
    'bronze',
    'silver',
    'gold',
    'backpack',
    'shoe',
    'goethe',
    'witch',
    'border',
  ])
    assert.deepEqual(badge(album, id).titles, []);
});
test('selection respects unlocks, independent title/frame, order, emptiness and revocation', () => {
  const album = buildAlbum(
    stamps,
    visits(Array.from({ length: 58 }, (_, i) => i + 1))
  );
  const input = {
    featured: ['king', 'bronze', 'gold'],
    title: 'king:1',
    frame: 'gold',
  };
  assert.deepEqual(sanitizeSelection(input, album), input);
  const revoked = sanitizeSelection(
    input,
    buildAlbum(stamps, visits([1, 2, 3, 4, 5, 6, 7, 8]))
  );
  assert.deepEqual(revoked, { featured: ['bronze'], title: '', frame: '' });
  assert.deepEqual(
    sanitizeSelection({ featured: [], title: '', frame: '' }, album),
    { featured: [], title: '', frame: '' }
  );
});

test('theme frames unlock independently and are revoked when their required visit disappears', () => {
  for (const id of ['goethe', 'witch', 'border']) {
    const rule = catalog.find((entry) => entry.id === id);
    const numbers = [...rule.required, ...(rule.pool ?? []).slice(0, rule.poolCount)];
    const themedStamps = numbers.map((number, i) => ({ ID: `theme${i}`, number: String(number) }));
    const history = themedStamps.map((stamp) => ({ stamp_ID: stamp.ID, visitedAt: '2026-10-15' }));
    const selection = { featured: [id], title: 'wanderer', frame: id };
    const earned = buildAlbum(themedStamps, history);
    assert.equal(badge(earned, id).unlocked, true);
    assert.deepEqual(sanitizeSelection(selection, earned), selection);
    assert.deepEqual(sanitizeSelection(selection, buildAlbum(themedStamps, history.slice(1))), {
      featured: [], title: 'wanderer', frame: '',
    });
  }
});
