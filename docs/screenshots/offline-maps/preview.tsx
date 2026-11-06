import React from 'react';
import { createRoot } from 'react-dom/client';
import { OfflineMapManager } from '../../../app/components/offline-map-manager';
const state = new URLSearchParams(window.location.search).get('state');
createRoot(document.getElementById('root')!).render(<OfflineMapManager packs={[{
  id: 'map-fixture', name: 'Brocken & Schierke', bounds: [10.56, 51.74, 10.71, 51.84],
  bytes: 18_600_000, createdAt: '2026-10-20T08:00:00Z', tileCount: 150,
}]} loading={false} busy={state === 'downloading'}
  progress={state === 'downloading' ? { completed: 75, total: 150, bytes: 9_300_000 } : null}
  error={state === 'failed' ? 'Die Verbindung wurde unterbrochen. Bitte starte den Download erneut.' : null}
  currentAreaName="Ausschnitt aus meiner Karte herunterladen"
  onDownload={() => {}} onOpen={() => {}} onDelete={() => {}} onCancel={() => {}} />);
