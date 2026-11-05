import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { OfflineVisitStatus, OfflineVisitStatusContent } from '@/components/offline-visit-status';
import type { OfflineVisit } from '@/lib/offline-visit-queue';
import type { OfflineNote } from '@/lib/offline-note-queue';

let mockOffline = true;
let mockEntries: OfflineVisit[] = [];
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOffline: mockOffline, isReady: true }) }));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/lib/offline-visits', () => ({ useOfflineVisits: () => ({ entries: mockEntries, userId: 'alice', syncing: false, storageError: null }) }));
jest.mock('@/lib/offline-notes', () => ({ useOfflineNotes: () => ({ entries: [], syncing: false, storageError: null }) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
const entry = { id: 'visit', stamp: { ID: 'stamp', number: '1', name: 'Brocken' }, visitedAt: '2026-10-20T08:00:00Z', status: 'pending' } as OfflineVisit;
const note: OfflineNote = { stampId: 'stamp', revision: 1, note: 'Wunderschöner Ausblick', base: null, status: 'pending' };
const defaults = { entries: [entry], syncing: false, isOffline: true, storageError: null, onRetry: jest.fn(), onDiscard: jest.fn() };
const open = () => fireEvent.press(screen.getByRole('button', { name: /Synchronisierungsstatus anzeigen/ }));

it('shows only a compact combined badge until tapped, while keeping page content', () => {
  render(<OfflineVisitStatusContent {...defaults} noteEntries={[note]}><Text>Stempelstellen</Text></OfflineVisitStatusContent>);
  expect(screen.getByText('Stempelstellen')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.queryByText('Synchronisierungsstatus')).toBeNull();
  expect(screen.queryByText('1 Besuch auf diesem Gerät')).toBeNull();
  open();
  expect(screen.getByText('Besuch · 1 · Brocken')).toBeTruthy();
  expect(screen.getByText('Notiz · Brocken')).toBeTruthy();
  expect(screen.getByText('2 Änderungen auf diesem Gerät gespeichert')).toBeTruthy();
  fireEvent.press(screen.getByText('Schließen'));
  expect(screen.queryByText('Synchronisierungsstatus')).toBeNull();
});

it('explains an offline sync attempt without claiming server success', async () => {
  const retry = jest.fn(async () => {});
  render(<OfflineVisitStatusContent {...defaults} onRetry={retry} />);
  open();
  await act(async () => { fireEvent.press(screen.getByText('Jetzt synchronisieren')); });
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Noch keine Internetverbindung/)).toBeTruthy();
});

it('keeps failures visible with retry and explicit discard', async () => {
  const retry = jest.fn(); const discard = jest.fn();
  render(<OfflineVisitStatusContent {...defaults} entries={[{ ...entry, status: 'failed' }]} isOffline={false} onRetry={retry} onDiscard={discard} />);
  open();
  expect(screen.getByText(/vom Server nicht angenommen/)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText('Jetzt synchronisieren')); });
  expect(retry).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Lokalen Eintrag verwerfen'));
  expect(discard).toHaveBeenCalledWith('visit');
});

it('does not claim persistence when device storage fails', () => {
  render(<OfflineVisitStatusContent {...defaults} entries={[]} storageError="Speicher voll" />);
  open();
  expect(screen.getByText(/Ein Speichervorgang ist fehlgeschlagen/)).toBeTruthy();
  expect(screen.getByText('Speicher voll')).toBeTruthy();
  expect(screen.queryByText(/Änderung auf diesem Gerät gespeichert/)).toBeNull();
});

it('opens note conflicts without discarding either version', () => {
  const openNote = jest.fn();
  render(<OfflineVisitStatusContent {...defaults} noteEntries={[{ ...note, status: 'conflict', remote: null }]} onOpenNote={openNote} />);
  open();
  fireEvent.press(screen.getByText('Konflikt öffnen'));
  expect(openNote).toHaveBeenCalledWith('stamp');
  expect(screen.queryByText('Synchronisierungsstatus')).toBeNull();
});

it('does not flash a pending banner for a successful online upload', () => {
  jest.useFakeTimers();
  mockOffline = false; mockEntries = [entry];
  const view = render(<OfflineVisitStatus><Text>Inhalt</Text></OfflineVisitStatus>);
  expect(screen.queryByRole('button', { name: /Synchronisierungsstatus anzeigen/ })).toBeNull();
  act(() => { jest.advanceTimersByTime(1000); });
  mockEntries = []; view.rerender(<OfflineVisitStatus><Text>Inhalt</Text></OfflineVisitStatus>);
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.queryByRole('button', { name: /Synchronisierungsstatus anzeigen/ })).toBeNull();
  view.unmount(); jest.useRealTimers();
});

it('shows prolonged online pending work and immediately shows offline work', () => {
  jest.useFakeTimers();
  mockOffline = false; mockEntries = [entry];
  const view = render(<OfflineVisitStatus />);
  act(() => { jest.advanceTimersByTime(2500); });
  expect(screen.getByText('Synchronisierung')).toBeTruthy();
  mockOffline = true; view.rerender(<OfflineVisitStatus />);
  expect(screen.getByText('Offline')).toBeTruthy();
  view.unmount(); jest.useRealTimers();
});
