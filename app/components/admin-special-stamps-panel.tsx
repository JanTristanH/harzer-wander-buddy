import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { initializeSpecialStamps, type SpecialStampInitialization } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function AdminSpecialStampsPanel() {
  const { accessToken, isOffline, canPerformWrites } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SpecialStampInitialization | null>(null);
  const [error, setError] = useState('');
  const disabled = busy || isOffline || !canPerformWrites || !accessToken;
  async function run(preview: boolean) {
    if (disabled || !accessToken) return;
    setBusy(true); setError('');
    try {
      setResult(await initializeSpecialStamps(accessToken, preview));
      if (!preview) await client.invalidateQueries();
    } catch (e) { setError(e instanceof Error ? e.message : 'Initialisierung fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  return <View style={styles.card}>
    <Text style={styles.title}>Sonderstempel initialisieren</Text>
    <Text style={styles.body}>Ergänzt die offiziell belegten Sonder- und Themenstempel. Vorhandene Einträge, Besuche und Meldungen bleiben erhalten. Wiederholung legt keine Duplikate an.</Text>
    <Pressable accessibilityRole="button" disabled={Boolean(disabled)} onPress={() => void run(true)} style={styles.button}>
      <Text style={styles.link}>{busy ? 'Bitte warten …' : 'Katalog prüfen (Vorschau)'}</Text>
    </Pressable>
    {result ? <>
      <Text style={styles.body}>{result.total} im Katalog · {result.existing} vorhanden · {result.preview ? result.pending + ' fehlen' : result.created + ' angelegt'}</Text>
      <Text style={styles.body}>{result.withoutCoordinates} ohne festen bestätigten Kartenstandort. Quellenstand: {result.checkedAt}.</Text>
      {result.conflicts.map(entry => <Text key={entry.catalogKey} style={styles.error}>Konflikt prüfen: {entry.name}. Bestehender Eintrag wurde nicht verändert.</Text>)}
    </> : null}
    <Pressable accessibilityRole="button" disabled={Boolean(disabled)} onPress={() => void run(false)} style={[styles.button, styles.primary, disabled && styles.disabled]}>
      <Text style={styles.primaryText}>Fehlende Sonderstempel in der DB anlegen</Text>
    </Pressable>
    {isOffline ? <Text style={styles.error}>Nur online verfügbar.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, backgroundColor: '#fff', gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#4c3769' }, body: { color: '#525c55', lineHeight: 21 },
  button: { borderRadius: 12, padding: 14, backgroundColor: '#f0eaf7' }, link: { color: '#68458f', fontWeight: '700' },
  primary: { backgroundColor: '#7851a9' }, primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 }, error: { color: '#a13e36' },
});
