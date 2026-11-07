// Official information checked 2026-10-29. Digital demo progress is not a physical award claim.
export const officialLinks = {
  awards:
    'https://www.harzer-wandernadel.de/die-wandernadel/leistungsabzeichen/',
  outlets:
    'https://www.harzer-wandernadel.de/die-wandernadel/vertriebspartner/',
  themes: 'https://www.harzer-wandernadel.de/die-wandernadel/themenhefte/',
};
export function physicalReward(entry: import('./badge-types').BadgeEntry) {
  return {
    heading: entry.unlocked
      ? 'Digital erreicht · auch als echte Wandernadel erhältlich'
      : 'Auch als echte Wandernadel erhältlich',
    description:
      'Mit den erforderlichen Nachweisen im Wanderpass kannst du diese Auszeichnung gegen eine Schutzgebühr erwerben. Nimm deinen Pass zur Vertriebsstelle oder zum Servicebüro in Blankenburg mit.',
    booklet: ['steiger', 'goethe', 'witch', 'border'].includes(entry.id)
      ? 'Zusätzlich ist das passende Begleitheft erforderlich.'
      : '',
    special:
      entry.id === 'border'
        ? 'Beim Grenzweg nennen die offiziellen Seiten unterschiedliche Voraussetzungen: 20 + 3 bzw. 22 + 3 Stempel. Kläre die Ausgabe vorher mit dem Servicebüro.'
        : entry.id === 'prince'
          ? 'Die offizielle Auszeichnung wird inzwischen für Jung und Alt angeboten; erforderlich sind 11 unterschiedliche reguläre Stempel.'
          : '',
    availability:
      'Bitte vorher erfragen, ob das gewünschte Abzeichen dort verfügbar ist.',
    proof:
      'Digitale Besuche ersetzen nicht die offiziellen Nachweise im Wanderpass.',
    source: ['goethe', 'witch', 'border', 'steiger'].includes(entry.id)
      ? officialLinks.themes
      : officialLinks.awards,
  };
}
