import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import type { TourPathEntry } from '@/lib/api';
import { buildTourGpx } from '@/lib/tour-gpx';
import { shareGpx } from '@/lib/share-gpx';

export function TourGpxExport({ name, path, disabled = false, onExported }: {
  name: string; path: TourPathEntry[]; disabled?: boolean; onExported?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function handleExport() {
    setBusy(true);
    try {
      const file = buildTourGpx(name, path);
      await shareGpx(file.fileName, file.content);
      onExported?.();
    } catch (error) {
      Alert.alert('GPX-Export nicht möglich', error instanceof Error ? error.message : 'Bitte versuche es erneut.');
    } finally {
      setBusy(false);
    }
  }
  return <Pressable accessibilityRole="button" accessibilityLabel="Tour als GPX exportieren"
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
    onPress={() => void handleExport()} style={[styles.button, (disabled || busy) && styles.disabled]}>
    <Feather name="download" size={15} color="#2e3a2e" />
    <Text style={styles.label}>{busy ? 'Exportiert …' : 'Als GPX exportieren'}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#2e3a2e', fontSize: 13, lineHeight: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
