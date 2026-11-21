import badgeSpecialKeys from './badge-special-stamps.json';
import regularThemes from './regular-stamp-themes.json';
import type { Stampbox } from './api';

export type StampTypeFilter = 'auto' | 'all' | 'regular' | 'special';
export function isSpecialStamp(stamp: Pick<Stampbox, 'number' | 'stampType' | 'catalogKey'>) {
  if (stamp.stampType === 'special') return true;
  if (/^(special-|hwn:special:)/.test(stamp.catalogKey || '')) return true;
  return !/^\d+$/.test(stamp.number) || Number(stamp.number) < 1 || Number(stamp.number) > 222;
}
export function matchesStampType(stamp: Pick<Stampbox, 'number' | 'stampType' | 'catalogKey'>, filter: StampTypeFilter) {
  return filter === 'all' || filter === 'auto' || (filter === 'special') === isSpecialStamp(stamp);
}
export function regularStampCounts(stamps: Stampbox[]) {
  const numbers = new Set(stamps.filter(s => !isSpecialStamp(s)).map(s => Number(s.number)));
  const visited = new Set(stamps.filter(s => !isSpecialStamp(s) && s.hasVisited).map(s => Number(s.number)));
  return { total: numbers.size, visited: visited.size };
}
export function stampThemes(stamp: Pick<Stampbox, 'themeKeys' | 'number' | 'stampType' | 'catalogKey'>): string[] {
  try {
    if (!stamp.themeKeys && !isSpecialStamp(stamp)) return (regularThemes as Record<string, string[]>)[String(Number(stamp.number))] || [];
    const themes = JSON.parse(stamp.themeKeys || '[]');
    return Array.isArray(themes) ? themes.filter((key): key is string => typeof key === 'string') : [];
  } catch { return []; }
}
export const stampThemeLabels: Record<string, string> = {
  sonderstempel: 'Dauerhafte Sonderstempel', grenzweg: 'Grenzweg', lutherweg: 'Lutherweg',
  karstwanderweg: 'Karstwanderweg', geschichtsorte: 'Burgen & Schlösser',
  'huy-fallstein': 'Huy-Fallstein', talsperren: 'Talsperren',
  'jubilaeum-2026': 'Jubiläum 2026', jubilaeum: 'Jubiläumsheft',
  klosterwanderweg: 'Klosterwanderweg', quedlinburg: 'Quedlinburg',
};
export const SPECIAL_STAMP_COLOR = '#7851a9';

export function matchesStampTheme(stamp: Pick<Stampbox, 'themeKeys' | 'number' | 'stampType' | 'catalogKey'>, theme: string) {
  if (!theme) return true;
  if (theme === 'badge-relevant') {
    if (!isSpecialStamp(stamp)) return false;
    if (stamp.catalogKey) return badgeSpecialKeys.catalogKeys.includes(stamp.catalogKey);
    const number = stamp.number.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    return badgeSpecialKeys.legacyNumbers.includes(number);
  }
  return stampThemes(stamp).includes(theme);
}
