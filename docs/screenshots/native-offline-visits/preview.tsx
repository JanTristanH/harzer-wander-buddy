import { Feather } from '@expo/vector-icons';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OfflineVisitStatusContent } from '../../../app/components/offline-visit-status';
import type { OfflineVisit } from '../../../app/lib/offline-visit-queue';
import type { OfflineNote } from '../../../app/lib/offline-note-queue';
import locationImage from '../../../backend/hwb/app/frontendhwb/webapp/images/placeholder/LocationPlaceholder.jpg';

const state = new URLSearchParams(window.location.search).get('state');
const failed = state === 'failed';
const entries: OfflineVisit[] = [{ id: '11111111-1111-4111-8111-111111111111', stamp: { ID: 'ecker', number: '1', name: 'Eckertalsperre – Staumauer', hasVisited: true }, visitedAt: '2026-11-05T14:42:00Z', status: failed ? 'failed' : 'pending' }];
const notes: OfflineNote[] = [{ stampId: 'ecker', revision: 1, note: 'Schöner Ausblick auf den See.', base: null, status: state === 'conflict' ? 'conflict' : 'pending', remote: null }];
const names = ['Eckertalsperre – Staumauer', 'Scharfenstein – Rangerstation', 'Am Kruzifix', 'Taubenklippe'];
const styles = StyleSheet.create({
  statusBar: { height: 36, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f3ee' },
  page: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, marginTop: 10 },
  title: { color: '#1e2a1e', fontFamily: 'Georgia', fontSize: 28 },
  group: { color: '#2e6b4b', padding: 9, borderRadius: 20, backgroundColor: '#eef4ef', fontSize: 13 },
  progress: { borderRadius: 22, padding: 20, backgroundColor: '#3e805b', gap: 14, marginBottom: 20 },
  eyebrow: { color: '#e1eadc', fontSize: 11, letterSpacing: 1 },
  total: { color: '#fff', fontSize: 22, fontWeight: '700' },
  track: { height: 7, backgroundColor: '#9fbe99', borderRadius: 5 },
  copy: { color: '#6b7a6b', fontSize: 13, lineHeight: 19 },
  search: { padding: 15, backgroundColor: '#fff', borderRadius: 22, color: '#6b7a6b', marginBottom: 14 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filter: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 22, backgroundColor: '#fff', fontSize: 13, color: '#2e3a2e' },
  active: { color: '#fff', backgroundColor: '#2e6b4b' },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 22, padding: 14, marginBottom: 12 },
  image: { width: 60, height: 70, borderRadius: 14 },
  name: { fontSize: 15, fontWeight: '700', color: '#1e2a1e' },
  visited: { color: '#2e6b4b', backgroundColor: '#e7f0e8', borderRadius: 18, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, marginTop: 6, fontSize: 12 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', paddingTop: 14, paddingBottom: 22, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  tab: { alignItems: 'center', gap: 5 },
});

createRoot(document.getElementById('root')!).render(<>
  <View style={styles.statusBar}><Text style={{ fontWeight: '600' }}>15:42</Text><Text>▮▮▮  ▰ 47%</Text></View>
  <OfflineVisitStatusContent entries={entries} noteEntries={notes} syncing={false} isOffline={!failed} storageError={state === 'storage' ? 'Nicht genügend freier Gerätespeicher.' : null}
    onRetry={async () => {}} onDiscard={() => {}} onOpenNote={() => {}} bottomInset={8}>
    <ScrollView style={styles.page}>
      <View style={styles.header}><Text style={styles.title}>Stempelstellen</Text><Text style={styles.group}>♧ Gruppe</Text></View>
      <View style={styles.progress}>
        <Text style={styles.eyebrow}>DEIN FORTSCHRITT</Text><Text style={styles.total}>5 von 222 Stempelstellen</Text>
        <View style={styles.track} /><Text style={{ color: '#e1eadc', fontSize: 12 }}>Letzter Besuch: Stempel 1 · Eckertalsperre · heute</Text>
      </View>
      <Text style={styles.search}>⌕  Suche nach Nummer oder Ort</Text>
      <View style={styles.filters}>{['Alle', 'Besucht', 'Unbesucht'].map((filter, i) => <Text key={filter} style={[styles.filter, i === 0 && styles.active]}>{filter}</Text>)}</View>
      {names.map((name, i) => <View key={name} style={styles.card}>
        <Image source={{ uri: locationImage }} style={styles.image} />
        <View style={{ flex: 1 }}><Text style={styles.name}>{i + 1} · {name}</Text><Text numberOfLines={2} style={styles.copy}>Entdecke diese Stempelstelle im Nationalpark Harz.</Text><Text style={styles.visited}>✓ Besucht</Text></View>
        <Feather name="chevron-right" color="#6b7a6b" size={18} />
      </View>)}
    </ScrollView>
    <View style={styles.tabs}>{(['list', 'map', 'navigation', 'users', 'user'] as const).map((icon, i) => <View style={styles.tab} key={icon}><Feather name={icon} size={24} color={i === 0 ? '#2e6b4b' : '#6b7a6b'} /><Text style={{ fontSize: 11, color: '#2e6b4b' }}>{['Liste', 'Karte', 'Touren', 'Freunde', 'Profil'][i]}</Text></View>)}</View>
  </OfflineVisitStatusContent>
</>);
