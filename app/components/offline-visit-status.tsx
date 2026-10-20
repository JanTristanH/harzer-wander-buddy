import React, { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnectivity } from '@/lib/connectivity';
import type { OfflineVisit } from '@/lib/offline-visit-queue';
import { useOfflineVisits } from '@/lib/offline-visits';

type Props = {
  entries: readonly OfflineVisit[];
  syncing: boolean;
  isOffline: boolean;
  storageError: string | null;
  bottomInset?: number;
  onRetry(): void;
  onDiscard(id: string): void;
};

// Shared production view; can also be rendered in an isolated preview without a native runtime.
export function OfflineVisitStatusContent({ entries, syncing, isOffline, storageError, bottomInset = 0, onRetry, onDiscard }: Props) {
  const [expanded, setExpanded] = useState(false);
  const failedCount = entries.filter((entry) => entry.status === 'failed').length;
  if (!entries.length && !storageError) return null;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Lokal gespeicherte Besuche anzeigen"
      onPress={() => setExpanded(true)} style={[styles.status, { bottom: bottomInset + 100 }]}>
      <Text style={styles.statusTitle}>{storageError ? 'Lokalen Speicher prüfen' : failedCount ? `${failedCount} ${failedCount === 1 ? 'Besuch' : 'Besuche'} prüfen` : syncing ? 'Besuche werden übertragen …' : `${entries.length} ${entries.length === 1 ? 'Besuch' : 'Besuche'} auf diesem Gerät`}</Text>
      <Text style={styles.statusCopy}>{storageError ? 'Nicht gespeichert · bitte Speicher prüfen' : isOffline ? 'Wird bei Verbindung synchronisiert' : 'Antippen für den Übertragungsstatus'}</Text>
    </Pressable>
    <Modal visible={expanded} transparent animationType="slide" onRequestClose={() => setExpanded(false)}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: bottomInset + 24 }]}>
          <Text accessibilityRole="header" style={styles.title}>Deine gespeicherten Besuche</Text>
          <Text style={styles.copy}>{storageError ? 'Ein Speichervorgang ist fehlgeschlagen. Nur die unten aufgeführten Besuche sind lokal gesichert.' : 'Auf diesem Gerät gesichert. Bei Verbindung werden deine eigenen Besuche mit ihrem ursprünglichen Zeitpunkt übertragen.'}</Text>
          <Text style={styles.hint}>Gruppenstempeln, Bearbeiten und Entfernen benötigen weiterhin Internet.</Text>
          {storageError ? <Text accessibilityRole="alert" style={styles.error}>{storageError}</Text> : null}
          {failedCount > 0 ? <Text accessibilityRole="alert" style={styles.error}>Einige Besuche wurden vom Server nicht angenommen. Sie bleiben hier gespeichert. Bitte erneut versuchen oder den Eintrag nach Prüfung verwerfen.</Text> : null}
          <ScrollView style={styles.list}>
            {entries.map((entry) => <View key={entry.id} style={styles.row}>
              <Text style={styles.rowTitle}>{entry.stamp.number ? `${entry.stamp.number} · ` : ''}{entry.stamp.name}</Text>
              <Text style={styles.copy}>{new Date(entry.visitedAt).toLocaleString('de-DE')}</Text>
              <Text style={entry.status === 'failed' ? styles.error : styles.saved}>{entry.status === 'failed' ? 'Nicht übertragen · bitte prüfen' : 'Auf Gerät gespeichert · Übertragung ausstehend'}</Text>
              {entry.status === 'failed' ? <Pressable accessibilityRole="button" disabled={syncing} onPress={() => onDiscard(entry.id)} style={styles.discard}>
                <Text style={styles.error}>Lokalen Eintrag verwerfen</Text>
              </Pressable> : null}
            </View>)}
          </ScrollView>
          <Pressable accessibilityRole="button" disabled={syncing} onPress={onRetry} style={[styles.primary, syncing && styles.disabled]}>
            <Text style={styles.primaryText}>{syncing ? 'Übertragung läuft …' : isOffline ? 'Speicher erneut prüfen' : 'Erneut übertragen'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setExpanded(false)} style={styles.secondary}><Text style={styles.saved}>Schließen</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

export function OfflineVisitStatus() {
  const offline = useOfflineVisits();
  const { isOffline } = useConnectivity();
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web' || !offline.userId) return null;
  return <OfflineVisitStatusContent {...offline} isOffline={isOffline} bottomInset={insets.bottom}
    onRetry={() => { void offline.retry(); }}
    onDiscard={(id) => Alert.alert('Lokalen Besuch verwerfen?', 'Dieser nicht übertragene Besuch wird nur von diesem Gerät entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: () => { void offline.discard(id); } },
    ])} />;
}

const styles = StyleSheet.create({
  status: { position: 'absolute', left: 24, right: 24, padding: 12, borderRadius: 18, backgroundColor: '#edf5ef', borderWidth: 1, borderColor: '#94b69c', zIndex: 998 },
  statusTitle: { color: '#24543a', fontWeight: '700', fontSize: 14 },
  statusCopy: { color: '#40584a', fontSize: 12, marginTop: 3 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,30,25,0.35)' },
  sheet: { maxHeight: '85%', padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#faf9f4' },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '700', color: '#253d30', marginBottom: 12 },
  copy: { color: '#455849', fontSize: 14, lineHeight: 21 },
  hint: { color: '#617063', fontSize: 12, lineHeight: 18, marginVertical: 12 },
  list: { flexGrow: 0, marginBottom: 16 },
  row: { borderBottomWidth: 1, borderBottomColor: '#dce3d9', paddingVertical: 14 },
  rowTitle: { color: '#253d30', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  saved: { color: '#2e6b4b', fontSize: 13, lineHeight: 19 },
  error: { color: '#92382f', fontSize: 13, lineHeight: 19 },
  discard: { alignSelf: 'flex-start', paddingVertical: 10 },
  primary: { backgroundColor: '#2e6b4b', borderRadius: 16, alignItems: 'center', padding: 15 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: { alignItems: 'center', padding: 15 },
  disabled: { opacity: 0.6 },
});
