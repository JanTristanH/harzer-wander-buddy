import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { isSpecialStamp, matchesStampType, regularStampCounts, stampThemes } from '@/lib/stamp-catalog';
import { resolveStampMarkerVisualKind, specialMarkerVisualKind } from '@/lib/group-marker';
import { StampCatalogFilters } from '@/components/stamp-catalog-filters';
import { AdminSpecialStampsPanel } from '@/components/admin-special-stamps-panel';
import { initializeSpecialStamps, type Stampbox } from '@/lib/api';
import { isMapStampVisible, MAP_DETAIL_LONGITUDE_DELTA } from '@/lib/map-stamp-visibility';

const mockAuth = { accessToken: 'test-only', isOffline: false, canPerformWrites: true };
const mockInvalidate = jest.fn();
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));
jest.mock('@/lib/api', () => ({ initializeSpecialStamps: jest.fn() }));
const stamp = (input: Partial<Stampbox>): Stampbox => ({ ID: 'stamp', number: '12', name: 'Stempel', ...input });

test('specials and relocated duplicates cannot inflate regular progress; explicit special type takes priority', () => {
  const regular = stamp({ hasVisited: true });
  const special = stamp({ ID: 'special', number: '12', stampType: 'special', catalogKey: 'special-test', hasVisited: true });
  expect(regularStampCounts([regular, { ...regular, ID: 'relocated' }, special, stamp({ number: '13' })])).toEqual({ total: 2, visited: 1 });
  expect(isSpecialStamp(special)).toBe(true);
  expect(isSpecialStamp(stamp({ number: '9901' }))).toBe(true);
  expect(matchesStampType(special, 'regular')).toBe(false);
  expect(matchesStampType(special, 'special')).toBe(true);
  expect(stampThemes(stamp({ number: '59' }))).toEqual([]);
  expect(stampThemes(stamp({ themeKeys: 'invalid' }))).toEqual([]);
});

test('special marker variants preserve visited and partial group status', () => {
  expect(specialMarkerVisualKind('visited-stamp')).toBe('special-visited-stamp');
  const partial = resolveStampMarkerVisualKind({ groupActive: true, groupSize: 3, totalGroupStampings: 1, personalKind: 'open-stamp' });
  expect(specialMarkerVisualKind(partial)).toBe('special-group-partial-stamp');
  expect(specialMarkerVisualKind('open-stamp')).toBe('special-open-stamp');
});

test('map default hides specials at overview zoom and reveals them only at parking detail level or by explicit choice', () => {
  const overview = { special: true, type: 'auto' as const, longitudeDelta: 0.42 };
  expect(isMapStampVisible(overview)).toBe(false);
  expect(isMapStampVisible({ ...overview, special: false })).toBe(true);
  expect(isMapStampVisible({ ...overview, longitudeDelta: MAP_DETAIL_LONGITUDE_DELTA })).toBe(false);
  expect(isMapStampVisible({ ...overview, longitudeDelta: 0.1 })).toBe(true);
  expect(isMapStampVisible({ ...overview, type: 'all' })).toBe(true);
  expect(isMapStampVisible({ ...overview, type: 'special' })).toBe(true);
  expect(isMapStampVisible({ ...overview, explicitFilter: true })).toBe(true);
  expect(isMapStampVisible({ ...overview, type: 'regular', longitudeDelta: 0.01, explicitFilter: true })).toBe(false);
});

test('type and theme filters expose independent, accessible selections', () => {
  const onType = jest.fn(), onTheme = jest.fn();
  render(<StampCatalogFilters type="special" theme="" themes={['grenzweg']} onTypeChange={onType} onThemeChange={onTheme} />);
  fireEvent.press(screen.getByRole('button', { name: 'Regulär (1–222)' }));
  fireEvent.press(screen.getByRole('button', { name: 'Grenzweg' }));
  expect(onType).toHaveBeenCalledWith('regular');
  expect(onTheme).toHaveBeenCalledWith('grenzweg');
  expect(screen.getByRole('button', { name: 'Sonderstempel', selected: true })).toBeOnTheScreen();
});

test('admin preview does not initialize; explicit initialize refreshes data; offline writes are disabled', async () => {
  jest.mocked(initializeSpecialStamps).mockResolvedValue({ preview: true, checkedAt: '2026-11-07', total: 151, existing: 0, created: 0, pending: 151, withoutCoordinates: 27, conflicts: [] });
  const view = render(<AdminSpecialStampsPanel />);
  fireEvent.press(screen.getByRole('button', { name: 'Katalog prüfen (Vorschau)' }));
  await waitFor(() => expect(initializeSpecialStamps).toHaveBeenCalledWith('test-only', true));
  await screen.findByText(/151 fehlen/);
  expect(mockInvalidate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Fehlende Sonderstempel in der DB anlegen' }));
  await waitFor(() => expect(initializeSpecialStamps).toHaveBeenCalledWith('test-only', false));
  await waitFor(() => expect(mockInvalidate).toHaveBeenCalled());
  mockAuth.isOffline = true;
  view.rerender(<AdminSpecialStampsPanel />);
  expect(screen.getByRole('button', { name: 'Fehlende Sonderstempel in der DB anlegen' })).toBeDisabled();
  mockAuth.isOffline = false;
});
