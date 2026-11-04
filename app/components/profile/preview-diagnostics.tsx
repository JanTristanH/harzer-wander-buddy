import { useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { clearPreviewLogs, isPreviewBuild, previewBuildDetails, readPreviewLogs, type PreviewLogEntry } from '@/lib/preview-diagnostics';

export function PreviewDiagnostics() {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<PreviewLogEntry[]>([]);
  const [error, setError] = useState('');
  if (!isPreviewBuild) return null;
  const details = previewBuildDetails();
  async function refresh() {
    setError('');
    try { setEntries(await readPreviewLogs()); }
    catch { setError('Das lokale Protokoll konnte nicht gelesen werden.'); }
  }
  async function share() {
    try {
      const logs = await readPreviewLogs();
      const text = logs.map(entry => `${entry.time} [${entry.level}] ${entry.event} ${entry.detail}`).join('\n');
      await Share.share({ title: 'HWB Preview-Protokoll', message: [
        'HWB Preview-Diagnose', JSON.stringify(details, null, 2), '',
        // Keep Android's share intent comfortably below its IPC size limit.
        text.length > 48000 ? `[Ältere Einträge gekürzt]\n${text.slice(-48000)}` : text,
        '', 'Native Prozessabstürze werden hier nicht zuverlässig erfasst. Dafür Android-Logcat verwenden.',
      ].join('\n') });
    } catch { setError('Das Protokoll konnte nicht geteilt werden.'); }
  }
  async function clear() {
    try { await clearPreviewLogs(); setEntries([]); setError(''); }
    catch { setError('Das Protokoll konnte nicht gelöscht werden.'); }
  }
  return (
    <>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setVisible(true); void refresh(); }}>
        <Text style={styles.buttonText}>Preview-Protokoll</Text>
      </Pressable>
      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Preview-Protokoll</Text>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setVisible(false)}><Text style={styles.buttonText}>Schließen</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text selectable style={styles.build}>PR {details.pr} · {details.sha || 'Commit nicht hinterlegt'}{'\n'}{details.backend}{'\n'}{details.deviceModel ? `${details.deviceModel} · ` : ''}{details.platform} {details.osVersion} · App {details.appVersion}{'\n'}Google Maps im Build: {details.mapsConfigured ? 'konfiguriert' : 'Key fehlt'}</Text>
            <Text style={styles.notice}>Die letzten 100 Einträge bleiben lokal auf diesem Gerät. Es gibt keinen automatischen Upload.</Text>
            <Text style={styles.notice}>Native Abstürze können den gesamten Prozess beenden, bevor JavaScript Logs speichert. Dieses Protokoll ersetzt keinen nativen Crash-Reporter.</Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => void refresh()}><Text style={styles.buttonText}>Aktualisieren</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => void share()}><Text style={styles.buttonText}>Teilen</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => void clear()}><Text style={styles.buttonText}>Logs löschen</Text></Pressable>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {!entries.length ? <Text style={styles.notice}>Noch keine Protokolleinträge.</Text> : null}
            {[...entries].reverse().map((entry, index) => (
              <View style={styles.entry} key={`${entry.time}-${index}`}>
                <Text selectable style={styles.timestamp}>{entry.time} · {entry.sha.slice(0, 12)}</Text>
                <Text selectable style={entry.level === 'error' ? styles.error : styles.event}>{entry.event}</Text>
                {entry.detail ? <Text selectable style={styles.detail}>{entry.detail}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f5ee', paddingTop: 36 },
  header: { paddingHorizontal: 18, gap: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  title: { color: '#1e2a1e', fontSize: 22, fontWeight: '600' },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#e4ebde', justifyContent: 'center' },
  buttonText: { color: '#244c36', fontWeight: '600' },
  build: { color: '#1e2a1e', fontSize: 14, lineHeight: 22 },
  notice: { color: '#4d5d4d', fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  entry: { padding: 12, borderRadius: 12, gap: 6, backgroundColor: '#ffffff' },
  timestamp: { color: '#667566', fontSize: 11 },
  event: { color: '#244c36', fontSize: 14, fontWeight: '600' },
  detail: { color: '#354535', fontSize: 12, lineHeight: 18 },
  error: { color: '#9a3333', fontSize: 14 },
});
