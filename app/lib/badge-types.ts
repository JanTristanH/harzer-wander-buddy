export type BadgeSelection = {
  featured: string[];
  title: string;
  frame: string;
};
export type BadgeEntry = {
  id: string;
  name: string;
  category: string;
  frame: string;
  icon:
    | 'feather'
    | 'award'
    | 'briefcase'
    | 'tool'
    | 'navigation'
    | 'book-open'
    | 'moon'
    | 'map'
    | 'star';
  condition: string;
  note?: string;
  unlocked: boolean;
  acquiredAt: string | null;
  titles: { id: string; label: string }[];
  progress: { label: string; current: number; total: number }[];
  required: {
    id: string | null;
    number: string;
    name: string;
    visited: boolean;
    mandatory: boolean;
  }[];
};
export type BadgeAlbum = {
  entries: BadgeEntry[];
  selection: BadgeSelection;
  selectionChanged: boolean;
};
export function badgeTitle(album?: BadgeAlbum) {
  if (album?.selection.title === 'wanderer') return 'Wanderer';
  return album?.entries
    .flatMap((entry) => entry.titles)
    .find((title) => title.id === album.selection.title)?.label;
}
