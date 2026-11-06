import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TourPathEntry } from '@/lib/api';
import { buildTourGpx, type TourGpxMode } from '@/lib/tour-gpx';
import { shareGpx } from '@/lib/share-gpx';

export function TourGpxExport({ name, path, disabled = false, onExported }: {
  name: string; path: TourPathEntry[]; disabled?: boolean; onExported?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  async function handleExport(mode: TourGpxMode) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const file = buildTourGpx(name, path, mode);
      await shareGpx(file.fileName, file.content);
      setChoosing(false);
      onExported?.();
    } catch (error) {
      Alert.alert('GPX-Export nicht möglich', error instanceof Error ? error.message : 'Bitte versuche es erneut.');
    } finally {
      setBusy(false);
    }
  }
  if (choosing) return <View style={styles.choices}>
    <Text style={styles.question}>Wie möchtest du exportieren?</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Verbundene Route"
      disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={() => void handleExport('connected')} style={[styles.choice, (disabled || busy) && styles.disabled]}>
      <Text style={styles.label}>Verbundene Route</Text>
      <Text style={styles.description}>Eine Tour mit allen Etappen, inklusive Autofahrten. Lücken werden direkt verbunden.</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Einzelne Etappen"
      disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={() => void handleExport('stages')} style={[styles.choice, (disabled || busy) && styles.disabled]}>
      <Text style={styles.label}>Einzelne Etappen</Text>
      <Text style={styles.description}>Jede Etappe als eigene Tour in einer GPX-Datei.</Text>
    </Pressable>
    {busy ? <Text accessibilityLiveRegion="polite" style={styles.description}>Exportiert …</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="GPX-Export abbrechen"
      disabled={busy} onPress={() => setChoosing(false)} style={styles.button}>
      <Text style={styles.label}>Abbrechen</Text>
    </Pressable>
  </View>;
  return <Pressable accessibilityRole="button" accessibilityLabel="Tour als GPX exportieren"
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
    onPress={() => setChoosing(true)} style={[styles.button, (disabled || busy) && styles.disabled]}>
    <Feather name="download" size={15} color="#2e3a2e" />
    <Text style={styles.label}>{busy ? 'Exportiert …' : 'Als GPX exportieren'}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#2e3a2e', fontSize: 13, lineHeight: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  choices: { gap: 8 },
  question: { color: '#2e3a2e', fontSize: 14, fontWeight: '600' },
  choice: { paddingHorizontal: 12, paddingVertical: 10, gap: 4, borderWidth: 1, borderColor: '#e4e8e4', borderRadius: 12 },
  description: { color: '#6b7a6b', fontSize: 12, lineHeight: 17 },
});
