import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { OfflineBanner } from '@/components/offline-banner';
import { AppColors, Fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/lib/connectivity';
import type { OfflineNote } from '@/lib/offline-note-queue';
import { useOfflineNotes } from '@/lib/offline-notes';
import type { OfflineVisit } from '@/lib/offline-visit-queue';
import { useOfflineVisits } from '@/lib/offline-visits';

type Props = React.PropsWithChildren<{
  entries: readonly OfflineVisit[];
  noteEntries?: readonly OfflineNote[];
  syncing: boolean;
  isOffline: boolean;
  storageError: string | null;
  noteStorageError?: string | null;
  visible?: boolean;
  topInset?: number;
  bottomInset?: number;
  onRetry(): void | Promise<void>;
  onDiscard(id: string): void;
  onOpenNote?(stampId: string): void;
  scope?: string;
}>;

// Shared production view, also used by the reproducible browser preview.
export function OfflineVisitStatusContent({ entries, noteEntries = [], syncing, isOffline, storageError, noteStorageError,
  visible = true, topInset = 0, bottomInset = 0, onRetry, onDiscard, onOpenNote, scope, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const offlineRef = useRef(isOffline);
  offlineRef.current = isOffline;
  const count = entries.length + noteEntries.length;
  const failedCount = entries.filter((entry) => entry.status === 'failed').length;
  const hasProblem = Boolean(storageError || noteStorageError || failedCount || noteEntries.some((e) => e.status !== 'pending'));
  const showStatus = visible && (isOffline || count > 0 || hasProblem);
  const busy = syncing || retrying;

  useEffect(() => { if (!isOffline) setRetryMessage(null); }, [isOffline]);
  useEffect(() => { setExpanded(false); setRetryMessage(null); }, [scope]);

  async function retry() {
    setRetrying(true);
    setRetryMessage(null);
    try {
      await onRetry();
      if (offlineRef.current) setRetryMessage('Noch keine Internetverbindung. Gespeicherte Änderungen bleiben erhalten; die Synchronisierung startet bei Verbindung automatisch.');
    } catch {
      setRetryMessage('Synchronisierung nicht möglich. Bitte erneut versuchen. Gespeicherte Änderungen bleiben erhalten.');
    } finally { setRetrying(false); }
  }

  return <View style={styles.layout}>
    {showStatus ? <View testID="offline-status-space" style={[styles.statusSpace, { paddingTop: topInset + 8 }]}>
      <OfflineBanner label={isOffline ? 'Offline' : hasProblem ? 'Synchronisierung prüfen' : 'Synchronisierung'} count={count}
        expanded={expanded} onPress={() => { setRetryMessage(null); setExpanded(true); }} />
    </View> : null}
    {/* A nested provider measures the navigator's new frame below the status row.
        Screens keep their own safe-area handling without counting the top inset twice. */}
    <SafeAreaProvider style={styles.content}>{children}</SafeAreaProvider>
    <Modal visible={expanded} transparent animationType="slide" onRequestClose={() => setExpanded(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Synchronisierungsstatus schließen" onPress={() => setExpanded(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: bottomInset + 16 }]}>
          <View style={styles.handle} />
          <ScrollView style={styles.list} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={styles.title}>Synchronisierungsstatus</Text>
            <Text style={styles.copy}>{count ? `${count} ${count === 1 ? 'Änderung' : 'Änderungen'} auf diesem Gerät gespeichert` : storageError || noteStorageError ? 'Lokaler Speicher nicht verfügbar' : 'Keine gespeicherten Änderungen ausstehend'}</Text>
            <View style={styles.connection}>
              <Feather name={isOffline ? 'cloud-off' : 'refresh-cw'} color={AppColors.primary} size={22} />
              <View style={styles.connectionCopy}>
                <Text style={styles.rowTitle}>{isOffline ? 'Keine Internetverbindung' : busy ? 'Synchronisierung läuft …' : 'Internetverbindung vorhanden'}</Text>
                <Text style={styles.copy}>{isOffline ? 'Gespeicherte Änderungen bleiben erhalten und werden bei Verbindung synchronisiert.' : 'Ausstehende Besuche und Notizen werden automatisch übertragen.'}</Text>
              </View>
            </View>
            {storageError || noteStorageError ? <>
              <Text accessibilityRole="alert" style={styles.error}>Ein Speichervorgang ist fehlgeschlagen. Nur die hier aufgeführten Änderungen sind lokal gesichert.</Text>
              {storageError ? <Text selectable style={styles.error}>{storageError}</Text> : null}
              {noteStorageError ? <Text selectable style={styles.error}>{noteStorageError}</Text> : null}
            </> : null}
            {failedCount > 0 ? <Text accessibilityRole="alert" style={styles.error}>Einige Besuche wurden vom Server nicht angenommen. Sie bleiben gespeichert. Bitte erneut versuchen oder nach Prüfung verwerfen.</Text> : null}
            {entries.map((entry) => <View key={entry.id} style={styles.row}>
              <Feather name="map-pin" size={22} color={AppColors.primary} />
              <View style={styles.connectionCopy}>
                <Text style={styles.rowTitle}>Besuch · {entry.stamp.number ? `${entry.stamp.number} · ` : ''}{entry.stamp.name}</Text>
                <Text style={styles.copy}>{new Date(entry.visitedAt).toLocaleString('de-DE')}</Text>
                <Text style={entry.status === 'failed' ? styles.error : styles.saved}>{entry.status === 'failed' ? 'Nicht übertragen · bitte prüfen' : syncing ? 'Übertragung läuft …' : 'Übertragung ausstehend'}</Text>
                {entry.status === 'failed' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => onDiscard(entry.id)} style={styles.discard}>
                  <Text style={styles.error}>Lokalen Eintrag verwerfen</Text>
                </Pressable> : null}
              </View>
            </View>)}
            {noteEntries.map((entry) => <View key={entry.stampId} style={styles.row}>
              <Feather name="file-text" size={22} color={AppColors.primary} />
              <View style={styles.connectionCopy}>
                <Text style={styles.rowTitle}>Notiz · {entries.find((visit) => visit.stamp.ID === entry.stampId)?.stamp.name ?? 'Stempelstelle'}</Text>
                <Text numberOfLines={2} style={styles.copy}>{entry.note || 'Notiz geleert'}</Text>
                <Text style={entry.status === 'pending' ? styles.saved : styles.error}>{entry.status === 'conflict' ? 'Konflikt · bitte Notiz prüfen' : entry.status === 'error' ? 'Übertragung fehlgeschlagen' : syncing ? 'Übertragung läuft …' : 'Übertragung ausstehend'}</Text>
                {onOpenNote ? <Pressable accessibilityRole="button" style={styles.discard} onPress={() => { setExpanded(false); onOpenNote(entry.stampId); }}>
                  <Text style={styles.saved}>{entry.status === 'conflict' ? 'Konflikt öffnen' : 'Notiz öffnen'}</Text>
                </Pressable> : null}
              </View>
            </View>)}
            <Text style={styles.hint}>Besuche werden mit ihrem ursprünglichen Zeitpunkt übertragen. Gruppenstempeln, Bearbeiten und Entfernen benötigen Internet.</Text>
            {retryMessage ? <Text accessibilityRole="alert" style={styles.copy}>{retryMessage}</Text> : null}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel={busy ? 'Synchronisierung läuft' : 'Jetzt synchronisieren'} disabled={busy} onPress={() => { void retry(); }} style={[styles.primary, busy && styles.disabled]}>
            <Feather name="refresh-cw" size={20} color="#fff" />
            <Text style={styles.primaryText}>{busy ? 'Synchronisierung läuft …' : 'Jetzt synchronisieren'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setExpanded(false)} style={styles.secondary}><Text style={styles.saved}>Schließen</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

export function OfflineVisitStatus({ children }: React.PropsWithChildren) {
  const visits = useOfflineVisits();
  const notes = useOfflineNotes();
  const { isAuthenticated } = useAuth();
  const { isOffline, isReady } = useConnectivity();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const count = visits.entries.length + notes.entries.length;
  // Successful online uploads should finish quietly. Show prolonged pending work,
  // offline work and errors, rather than flashing a banner for every online stamp.
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    setWaiting(false);
    if (isOffline || !count) return;
    const timer = setTimeout(() => setWaiting(true), 2500);
    return () => clearTimeout(timer);
  }, [count, isOffline, isAuthenticated]);
  const hasProblem = Boolean(visits.storageError || notes.storageError || visits.entries.some((e) => e.status === 'failed') || notes.entries.some((e) => e.status !== 'pending'));
  const visible = isAuthenticated && isReady !== false && (isOffline || waiting || hasProblem);
  return <OfflineVisitStatusContent entries={visits.entries} noteEntries={notes.entries} syncing={visits.syncing || notes.syncing}
    storageError={visits.storageError} noteStorageError={notes.storageError} isOffline={isOffline} visible={visible}
    topInset={insets.top} bottomInset={insets.bottom}
    scope={`${isAuthenticated}:${visits.userId ?? ''}`}
    onRetry={async () => { await Promise.all([visits.isNative ? visits.retry() : undefined, notes.isNative ? notes.retry() : undefined]); }}
    onOpenNote={(id) => router.push(`/stamps/${encodeURIComponent(id)}` as never)}
    onDiscard={(id) => Alert.alert('Lokalen Besuch verwerfen?', 'Dieser nicht übertragene Besuch wird nur von diesem Gerät entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: () => { void visits.discard(id); } },
    ])}>
    {children}
  </OfflineVisitStatusContent>;
}

const styles = StyleSheet.create({
  layout: { flex: 1, backgroundColor: AppColors.background },
  content: { flex: 1 },
  statusSpace: { paddingHorizontal: 24, paddingBottom: 8 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,30,25,0.35)' },
  sheet: { maxHeight: '85%', padding: 24, paddingTop: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: AppColors.background },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#c9c9c2', alignSelf: 'center', marginBottom: 16 },
  title: { fontFamily: Fonts.serif, fontSize: 26, lineHeight: 32, color: AppColors.text },
  copy: { color: AppColors.textSecondary, fontSize: 14, lineHeight: 21 },
  connection: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#eeeadd', marginVertical: 8 },
  connectionCopy: { flex: 1, gap: 4 },
  hint: { color: AppColors.textMuted, fontSize: 12, lineHeight: 18, marginVertical: 8 },
  list: { flexGrow: 0, marginBottom: 16 },
  sheetContent: { gap: 10 },
  row: { flexDirection: 'row', gap: 12, backgroundColor: AppColors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e3e6dd' },
  rowTitle: { color: AppColors.text, fontSize: 15, fontWeight: '700' },
  saved: { color: AppColors.primary, fontSize: 13, lineHeight: 19 },
  error: { color: '#8a2d1f', fontSize: 13, lineHeight: 19 },
  discard: { alignSelf: 'flex-start', paddingVertical: 10, minHeight: 44 },
  primary: { flexDirection: 'row', gap: 12, backgroundColor: AppColors.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 15, minHeight: 48 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15, flexShrink: 1 },
  secondary: { alignItems: 'center', padding: 15, minHeight: 44 },
  disabled: { opacity: 0.6 },
});
