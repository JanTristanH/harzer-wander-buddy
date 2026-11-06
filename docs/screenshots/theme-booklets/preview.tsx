import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeBookletsView } from '../../../app/components/theme-booklets-view';
import type { ThemeCatalogItem } from '../../../app/lib/api';
const sample: ThemeCatalogItem = {
  ID: 'border', code: 'grenzweg', edition: 'Badge-Katalog PR 65 – 20+3', name: 'Harzer Grenzweg', kind: 'booklet', badgeId: 'border',
  sourceUrl: 'https://www.harzer-wandernadel.de/stempelstellen/sonderstempel/',
  rulesNote: '20 reguläre Pflichtstellen plus Jungborn, Zweiländereiche und Dreiländerstein. Diese Ausgabe entspricht der bisherigen Regel im Abzeichenalbum.',
  expectedStampCount: 23, collectedCount: 20, requiredCount: 23, requiredCollected: 20, optionalCollected: 0,
  minimumOptionalCount: 0, regularVisitTarget: 0, regularVisited: 20, complete: false,
  // Only the excerpt needed to show the three formerly unavailable special places.
  stamps: [
    { stampId: 'regular', number: '1', name: 'Eckertalsperre', stampKind: 'regular', required: true, visited: true },
    { stampId: 'jungborn', number: '9901', name: 'Jungborn', stampKind: 'special', required: true, visited: false },
    { stampId: 'oak', number: '9902', name: 'Zweiländereiche', stampKind: 'special', required: true, visited: false },
    { stampId: 'stone', number: '9903', name: 'Dreiländerstein', stampKind: 'special', required: true, visited: false },
  ],
};
createRoot(document.getElementById('root')!).render(<ThemeBookletsView collections={[
  sample,
  { ...sample, ID: 'goethe', name: 'Goethe im Harz', edition: 'Badge-Katalog PR 65', badgeId: 'goethe', expectedStampCount: 28, collectedCount: 7 },
  { ...sample, ID: 'karst', name: 'Karstwanderweg Südharz', edition: 'Quellenstand 2026-10-20', badgeId: undefined, expectedStampCount: 24, collectedCount: 2 },
]} onStampPress={() => {}} onBadgePress={() => {}} onRefresh={() => {}} />);
