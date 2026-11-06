import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OFFLINE_MAP_AREAS, type OfflineMapPack, type OfflineMapProgress } from '@/lib/offline-maps';

export function OfflineMapManager({ packs, progress, busy, loading, error, currentAreaName, onDownload,
  onOpen, onDelete, onCancel }: {
  packs: OfflineMapPack[]; progress: OfflineMapProgress | null; busy: boolean; loading: boolean; error: string | null;
  currentAreaName?: string; onDownload: (area?: typeof OFFLINE_MAP_AREAS[number]) => void;
  onOpen: (pack: OfflineMapPack) => void; onDelete: (pack: OfflineMapPack) => void; onCancel: () => void;
}) {
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Offline-Wanderkarten</Text>
    <Text style={styles.body}>Lade vor deiner Wanderung einen Ausschnitt von etwa 10 × 10 km herunter. Wege, Wälder und Ortsnamen bleiben dann ohne Netz verfügbar.</Text>
    <Text style={styles.note}>Kartendetails bis Zoom 14, vergrößerbar bis Zoom 18. Ohne Höhenlinien oder automatische Navigation. Pro Download höchstens 50 MB.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {busy ? <View style={styles.card}>
      <Text style={styles.heading}>Karte wird heruntergeladen …</Text>
      <Text style={styles.body}>{progress ? `${Math.floor(progress.completed / progress.total * 100)} % · ${(progress.bytes / 1_000_000).toFixed(1)} MB` : 'Download wird vorbereitet …'}</Text>
      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondary}><Text>Abbrechen</Text></Pressable>
    </View> : null}
    <Text style={styles.heading}>Gespeicherte Karten</Text>
    {loading ? <Text>Karten werden geladen …</Text> : !packs.length ? <Text style={styles.body}>Noch keine Karte gespeichert.</Text> : null}
    {packs.map(pack => <View key={pack.id} style={styles.card}>
      <Text style={styles.heading}>{pack.name}</Text>
      <Text style={styles.body}>{(pack.bytes / 1_000_000).toFixed(1)} MB · Ohne Netz verfügbar</Text>
      <Text style={styles.note}>Stand: {new Date(pack.createdAt).toLocaleDateString('de-DE')}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${pack.name} öffnen`} disabled={busy} onPress={() => onOpen(pack)} style={styles.primary}><Text style={styles.primaryLabel}>Karte öffnen</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${pack.name} löschen`} disabled={busy} onPress={() => onDelete(pack)} style={styles.secondary}><Text>Löschen</Text></Pressable>
      </View>
    </View>)}
    <Text style={styles.heading}>Neuen Ausschnitt laden</Text>
    {currentAreaName ? <Pressable accessibilityRole="button" disabled={busy || loading} onPress={() => onDownload()} style={[styles.primary, busy && styles.disabled]}>
      <Text style={styles.primaryLabel}>{currentAreaName}</Text>
    </Pressable> : null}
    {OFFLINE_MAP_AREAS.map(area => <Pressable key={area.name} accessibilityRole="button" disabled={busy || loading}
      onPress={() => onDownload(area)} style={[styles.area, busy && styles.disabled]}><Text style={styles.areaLabel}>{area.name} herunterladen</Text></Pressable>)}
    <Text style={styles.note}>© OpenStreetMap-Mitwirkende · OpenMapTiles · OpenFreeMap. Stempel werden aus den in der App verfügbaren Daten eingeblendet. Kartenpakete bleiben auf diesem Gerät; zum Aktualisieren erneut herunterladen.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { padding: 22, gap: 15, backgroundColor: '#faf9f4', flexGrow: 1 },
  title: { fontSize: 25, fontWeight: '700', color: '#203c2a' },
  heading: { fontSize: 17, fontWeight: '700', color: '#203c2a' },
  body: { fontSize: 14, lineHeight: 21, color: '#3f503f' },
  note: { fontSize: 12, lineHeight: 18, color: '#65715f' },
  error: { color: '#a13932', lineHeight: 21 },
  card: { padding: 16, gap: 10, backgroundColor: '#edf2e7', borderRadius: 18 },
  row: { flexDirection: 'row', gap: 12 },
  primary: { padding: 13, backgroundColor: '#2e6b4b', borderRadius: 14, alignItems: 'center' },
  primaryLabel: { fontWeight: '700', color: '#fff', fontSize: 14 },
  secondary: { padding: 13, borderRadius: 14, backgroundColor: '#e0e5d9', alignItems: 'center' },
  area: { padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#d6dfcf' },
  areaLabel: { color: '#2e6b4b', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
