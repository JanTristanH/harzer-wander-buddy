// Digital achievements. Rules are independent of list selection and physical award issuance.
const mining = [
  37, 39, 60, 61, 85, 91, 107, 113, 126, 127, 128, 133, 137, 146, 155, 172, 175,
  179, 190, 193, 194, 217, 222,
];
const goethe = [
  9, 13, 14, 31, 38, 41, 42, 62, 69, 71, 78, 80, 85, 88, 91, 95, 99, 101, 105,
  116, 117, 129, 132, 136, 140, 144, 155, 188,
];
const border = [
  1, 2, 3, 4, 9, 10, 11, 18, 19, 46, 90, 136, 156, 159, 164, 165, 166, 167, 168,
  170,
];
const witch = [
  9, 13, 17, 22, 40, 41, 42, 52, 60, 62, 63, 123, 128, 133, 136, 137, 155, 178,
];
const special = [
  'special-two-countries-oak',
  'special-jungborn',
  'special-three-countries-stone',
];
const specialNames = {
  'special-two-countries-oak': 'Zwei-Länder-Eiche',
  'special-jungborn': 'Jungborn',
  'special-three-countries-stone': 'Drei-Länder-Stein',
};
function normalizeNumber(value) {
  const raw = String(value ?? '').trim();
  const officialSpecial = { '9901': special[1], '9902': special[0], '9903': special[2] };
  if (officialSpecial[raw]) return officialSpecial[raw];
  if (/^\d+$/.test(raw)) return String(Number(raw));
  const name = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  if (name.includes('jungborn')) return special[1];
  if (name.includes('dreilanderstein')) return special[2];
  if (name.includes('zweilandereiche') || name.includes('zweilaendereiche'))
    return special[0];
  return raw;
}
// Explicit special identities take precedence over display numbers and names.
function stampIdentity(stamp) {
  const keys = {
    'hwn:special:jungborn': special[1],
    'hwn:special:zweilaendereiche': special[0],
    'hwn:special:dreilaenderstein': special[2],
  };
  if (keys[stamp.catalogKey]) return keys[stamp.catalogKey];
  if (stamp.stampKind === 'special') {
    const legacy = normalizeNumber(stamp.number);
    return special.includes(legacy) ? legacy : `stamp:${stamp.ID}`;
  }
  return normalizeNumber(stamp.number);
}
const titles = {
  king: ['Wanderkönig', 'Wanderkönigin'],
  steiger: ['Harzer Steiger'],
  emperor: ['Wanderkaiser', 'Wanderkaiserin'],
  prince: ['Wanderprinzessin', 'Wanderprinz'],
};
const catalog = [
  {
    id: 'bronze',
    name: 'Bronze',
    category: 'Leistungsabzeichen',
    threshold: 8,
    frame: 'bronze',
    icon: 'feather',
  },
  {
    id: 'silver',
    name: 'Silber',
    category: 'Leistungsabzeichen',
    threshold: 16,
    frame: 'silver',
    icon: 'feather',
  },
  {
    id: 'gold',
    name: 'Gold',
    category: 'Leistungsabzeichen',
    threshold: 24,
    frame: 'gold',
    icon: 'feather',
  },
  {
    id: 'king',
    name: 'Wanderkönig',
    category: 'Leistungsabzeichen',
    threshold: 50,
    frame: 'king',
    icon: 'award',
  },
  {
    id: 'backpack',
    name: 'Kaiserrucksack',
    category: 'Leistungsabzeichen',
    threshold: 100,
    frame: 'backpack',
    icon: 'briefcase',
  },
  {
    id: 'steiger',
    name: 'Harzer Steiger',
    category: 'Leistungsabzeichen',
    threshold: 111,
    required: mining,
    frame: 'steiger',
    icon: 'tool',
  },
  {
    id: 'shoe',
    name: 'Kaiserschuh',
    category: 'Leistungsabzeichen',
    threshold: 150,
    frame: 'shoe',
    icon: 'navigation',
  },
  {
    id: 'emperor',
    name: 'Wanderkaiser',
    category: 'Leistungsabzeichen',
    threshold: 222,
    frame: 'emperor',
    icon: 'award',
  },
  {
    id: 'goethe',
    name: 'Goethe im Harz',
    category: 'Themenabzeichen',
    required: goethe,
    frame: 'goethe',
    icon: 'book-open',
  },
  {
    id: 'witch',
    name: 'Hexen-Stieg',
    category: 'Themenabzeichen',
    required: [69, 140],
    pool: witch,
    poolCount: 9,
    frame: 'witch',
    icon: 'moon',
  },
  {
    id: 'border',
    name: 'Grenzweg',
    category: 'Themenabzeichen',
    required: [...border, ...special],
    frame: 'border',
    icon: 'map',
  },
  {
    id: 'prince',
    name: 'Wanderprinzessin / Wanderprinz',
    category: 'Digitale Abzeichen',
    threshold: 11,
    frame: 'prince',
    icon: 'star',
    note: 'Dieses digitale Abzeichen ist für jedes Alter. Die offizielle Auszeichnung gilt für Kinder bis 11 Jahre.',
  },
];

function evaluate(rule, numbers) {
  const uniqueCount = [...numbers].filter(
    (n) => /^\d+$/.test(n) && Number(n) >= 1 && Number(n) <= 222
  ).length;
  const progress = [];
  if (rule.threshold)
    progress.push({
      label: 'Gesamtstempel',
      current: Math.min(uniqueCount, rule.threshold),
      total: rule.threshold,
    });
  if (rule.required)
    progress.push({
      label:
        rule.id === 'steiger' ? 'Bergbau-Pflichtstellen' : 'Pflichtstellen',
      current: rule.required.filter((n) => numbers.has(String(n))).length,
      total: rule.required.length,
    });
  if (rule.pool)
    progress.unshift({
      label: rule.poolLabel || 'Stempel entlang des Hexen-Stiegs',
      current: Math.min(
        rule.poolCount,
        rule.pool.filter((n) => numbers.has(String(n))).length
      ),
      total: rule.poolCount,
    });
  return { progress, unlocked: progress.every((p) => p.current >= p.total) };
}

function buildAlbum(stamps, visits, overrides = {}) {
  const stampsById = new Map(stamps.map((s) => [s.ID, s]));
  const numbers = new Set();
  const events = new Map();
  let incompleteHistory = false;
  for (const visit of visits) {
    const stamp = stampsById.get(visit.stamp_ID);
    if (!stamp) continue;
    const number = stampIdentity(stamp);
    numbers.add(number);
    // A missing visitedAt is not an acquisition date; createdAt may be an import date.
    const time = Date.parse(visit.visitedAt);
    if (!Number.isFinite(time)) incompleteHistory = true;
    if (Number.isFinite(time))
      events.set(number, Math.min(events.get(number) ?? Infinity, time));
  }
  const history = [...events].sort((a, b) => a[1] - b[1]);
  return catalog.map((baseRule) => {
    const rule = { ...baseRule, ...(overrides[baseRule.id] || {}) };
    const result = evaluate(rule, numbers);
    let acquiredAt = null;
    if (
      result.unlocked &&
      !incompleteHistory &&
      [...numbers].every((n) => events.has(n))
    ) {
      const seen = new Set();
      for (const [number, time] of history) {
        seen.add(number);
        if (evaluate(rule, seen).unlocked) {
          acquiredAt = new Date(time).toISOString();
          break;
        }
      }
    }
    const required = [...(rule.required ?? []), ...(rule.pool ?? [])].map(
      (n) => {
        const number = String(n);
        const stamp = stamps.find((s) => stampIdentity(s) === number);
        return {
          number,
          id: stamp?.ID ?? null,
          name:
            stamp?.name ?? specialNames[number] ?? `Stempelstelle ${number}`,
          visited: numbers.has(number),
          mandatory: !rule.pool || !rule.pool.includes(n),
        };
      }
    );
    const condition = rule.condition || (
      rule.id === 'steiger'
        ? '111 unterschiedliche Stempel, davon alle 23 Bergbau-Pflichtstellen.'
        : rule.id === 'witch'
          ? '9 beliebige Stempel entlang des Hexen-Stiegs sowie HWN 69 und HWN 140.'
          : rule.id === 'border'
            ? 'Alle 20 regulären Pflichtstellen und die 3 Sonderstempel Zwei-Länder-Eiche, Jungborn und Drei-Länder-Stein.'
            : rule.threshold
              ? `${rule.threshold} unterschiedliche reguläre Stempelstellen.`
              : `Alle ${rule.required.length} Pflichtstellen.`);
    return {
      ...rule,
      required,
      condition,
      ...result,
      acquiredAt,
      titles: (titles[rule.id] ?? []).map((label, index) => ({
        id: `${rule.id}:${index}`,
        label,
      })),
    };
  });
}

function sanitizeSelection(selection, entries) {
  const unlocked = entries.filter((e) => e.unlocked);
  const featured = [...new Set(selection.featured ?? [])]
    .filter((id) => unlocked.some((e) => e.id === id))
    .slice(0, 3);
  const title =
    selection.title === 'wanderer' ||
    unlocked.some((e) => e.titles.some((t) => t.id === selection.title))
      ? selection.title
      : '';
  const frame = unlocked.some((e) => e.id === selection.frame)
    ? selection.frame
    : '';
  return { featured, title, frame };
}
module.exports = { catalog, normalizeNumber, stampIdentity, evaluate, buildAlbum, sanitizeSelection };
