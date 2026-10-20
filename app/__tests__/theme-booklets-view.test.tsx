import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeBookletsView } from '@/components/theme-booklets-view';
import type { ThemeCatalogItem } from '@/lib/api';
const collection: ThemeCatalogItem = {
  ID: 'theme', code: 'grenzweg', edition: '20+3', name: 'Harzer Grenzweg', kind: 'booklet', badgeId: 'border',
  sourceUrl: 'https://example.org/source', rulesNote: 'Regeln der gewählten Ausgabe.', expectedStampCount: 2, collectedCount: 1,
  requiredCount: 2, requiredCollected: 1, optionalCollected: 0, minimumOptionalCount: 0, regularVisitTarget: 0, regularVisited: 1, complete: false,
  stamps: [
    { stampId: 'regular', number: '1', name: 'Eckertalsperre', stampKind: 'regular', required: true, visited: true },
    { stampId: 'special', number: '9901', name: 'Jungborn', stampKind: 'special', required: true, visited: false },
  ],
};
test('shows special stamp mappings, missing filter, stamp navigation and connection to existing badge album', () => {
  const onStampPress = jest.fn(), onBadgePress = jest.fn();
  const view = render(<ThemeBookletsView collections={[collection]} onStampPress={onStampPress} onBadgePress={onBadgePress} onRefresh={() => {}} />);
  expect(view.getByText('1 / 2 Stempel gesammelt')).toBeTruthy();
  fireEvent.press(view.getByText('Harzer Grenzweg'));
  fireEvent.press(view.getByText('Nur fehlende Stempel'));
  expect(view.queryByText('✓ 1 · Eckertalsperre')).toBeNull();
  fireEvent.press(view.getByText('○ 9901 · Jungborn'));
  expect(onStampPress).toHaveBeenCalledWith('special');
  fireEvent.press(view.getByText('Abzeichen im Album ansehen'));
  expect(onBadgePress).toHaveBeenCalledWith('border');
});
test('keeps cached collections visible when refreshing fails', () => {
  const view = render(<ThemeBookletsView collections={[collection]} error="Aktualisierung fehlgeschlagen" onStampPress={() => {}} onRefresh={() => {}} />);
  expect(view.getByText('Harzer Grenzweg')).toBeTruthy();
  expect(view.getByRole('alert')).toBeTruthy();
});
