import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { OfflineVisitStatusContent } from '@/components/offline-visit-status';
import type { OfflineVisit } from '@/lib/offline-visit-queue';
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOffline: true }) }));
const entry = { id: 'visit', stamp: { ID: 'stamp', number: '1', name: 'Brocken' }, visitedAt: '2026-10-20T08:00:00Z', status: 'pending' } as OfflineVisit;

it('explains local persistence and the online-only scope, and never claims server success', () => {
  render(<OfflineVisitStatusContent entries={[entry]} syncing={false} isOffline storageError={null} onRetry={jest.fn()} onDiscard={jest.fn()} />);
  fireEvent.press(screen.getByRole('button', { name: 'Lokal gespeicherte Besuche anzeigen' }));
  expect(screen.getByText('1 · Brocken')).toBeTruthy();
  expect(screen.getByText(/ursprünglichen Zeitpunkt/)).toBeTruthy();
  expect(screen.getByText(/Gruppenstempeln, Bearbeiten und Entfernen/)).toBeTruthy();
  expect(screen.getByText('Auf Gerät gespeichert · Übertragung ausstehend')).toBeTruthy();
});

it('keeps rejected visits visible and offers retry and explicit discard', () => {
  const retry = jest.fn(); const discard = jest.fn();
  render(<OfflineVisitStatusContent entries={[{ ...entry, status: 'failed' }]} syncing={false} isOffline={false} storageError={null} onRetry={retry} onDiscard={discard} />);
  fireEvent.press(screen.getByRole('button', { name: 'Lokal gespeicherte Besuche anzeigen' }));
  expect(screen.getByText(/vom Server nicht angenommen/)).toBeTruthy();
  fireEvent.press(screen.getByText('Erneut übertragen')); expect(retry).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Lokalen Eintrag verwerfen')); expect(discard).toHaveBeenCalledWith('visit');
});

it('does not claim successful device persistence after a storage failure', () => {
  render(<OfflineVisitStatusContent entries={[]} syncing={false} isOffline storageError="Speicher voll" onRetry={jest.fn()} onDiscard={jest.fn()} />);
  expect(screen.getByText('Nicht gespeichert · bitte Speicher prüfen')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Lokal gespeicherte Besuche anzeigen' }));
  expect(screen.getByText(/Ein Speichervorgang ist fehlgeschlagen/)).toBeTruthy();
  expect(screen.queryByText(/^Auf diesem Gerät gesichert\./)).toBeNull();
});
