import React from 'react';
import { createRoot } from 'react-dom/client';
import { StyleSheet, Text, View } from 'react-native';

import { OfflineVisitStatusContent } from '../../../app/components/offline-visit-status';
import type { OfflineVisit } from '../../../app/lib/offline-visit-queue';

const failed = new URLSearchParams(window.location.search).get('state') === 'failed';
const entries: OfflineVisit[] = [
  { id: '11111111-1111-4111-8111-111111111111', stamp: { ID: 'brocken', number: '1', name: 'Brocken', hasVisited: false }, visitedAt: '2026-10-20T09:12:00Z', status: failed ? 'failed' : 'pending' },
  { id: '22222222-2222-4222-8222-222222222222', stamp: { ID: 'torfhaus', number: '2', name: 'Torfhaus', hasVisited: false }, visitedAt: '2026-10-20T09:24:00Z', status: 'pending' },
];

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#faf9f4', padding: 24, paddingTop: 55 },
  eyebrow: { color: '#607363', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#253d30', fontSize: 30, fontWeight: '700', marginVertical: 16 },
  copy: { color: '#607363', fontSize: 14, lineHeight: 21 },
});

createRoot(document.getElementById('root')!).render(
  <View style={styles.page}>
    <Text style={styles.eyebrow}>MOBILE KOMPONENTENVORSCHAU</Text>
    <Text style={styles.title}>Offline-Besuche</Text>
    <Text style={styles.copy}>Die echte Statuskomponente mit lokalen Beispieldaten. Kein iOS- oder Android-Gerätetest.</Text>
    <OfflineVisitStatusContent entries={entries} syncing={false} isOffline={!failed} storageError={null} onRetry={() => undefined} onDiscard={() => undefined} />
  </View>
);
