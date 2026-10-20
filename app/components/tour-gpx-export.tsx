import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import type { TourPathEntry } from '@/lib/api';
import { buildTourGpx } from '@/lib/tour-gpx';
import { shareGpx } from '@/lib/share-gpx';

export function TourGpxExport({ name, path, disabled = false }: {
  name: string; path: TourPathEntry[]; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function handleExport() {
    setBusy(true);
    try {
      const file = buildTourGpx(name, path);
      await shareGpx(file.fileName, file.content);
    } catch (error) {
      Alert.alert('GPX-Export nicht möglich', error instanceof Error ? error.message : 'Bitte versuche es erneut.');
    } finally {
      setBusy(false);
    }
  }
  return <Pressable accessibilityRole="button" accessibilityLabel="Tour als GPX exportieren"
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
    onPress={() => void handleExport()} style={[styles.button, (disabled || busy) && styles.disabled]}>
    <Text style={styles.label}>{busy ? 'Exportiert …' : 'GPX'}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, backgroundColor: '#edf1f8' },
  label: { color: '#3a4f84', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
