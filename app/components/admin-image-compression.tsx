import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { compressExistingImages, HttpStatusError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Status = 'idle' | 'running' | 'paused' | 'complete' | 'error';
const emptyTotals = { compressed: 0, skipped: 0, failed: 0, bytesSaved: 0 };

export function AdminImageCompression() {
  const isFocused = useIsFocused();
  const { accessToken, canPerformWrites, isOffline, logout } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [totals, setTotals] = useState(emptyTotals);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPausing, setIsPausing] = useState(false);
  const cursor = useRef<string | undefined>(undefined);
  const running = useRef(false);
  const stop = useRef(false);
  const mounted = useRef(true);
  const auth = useRef({ accessToken, canPerformWrites, isOffline });
  auth.current = { accessToken, canPerformWrites, isOffline };
  const available = Boolean(accessToken && canPerformWrites && !isOffline && isFocused);

  useEffect(() => {
    if (!isFocused) stop.current = true;
  }, [isFocused]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') stop.current = true;
    });
    return () => {
      mounted.current = false;
      stop.current = true;
      subscription.remove();
    };
  }, []);

  async function start() {
    if (running.current || !available) return;
    running.current = true;
    stop.current = false;
    if (status === 'complete') {
      cursor.current = undefined;
      setTotals(emptyTotals);
    }
    setStatus('running');
    setIsPausing(false);
    setErrorMessage('');
    try {
      while (!stop.current && mounted.current) {
        const current = auth.current;
        if (!current.accessToken || !current.canPerformWrites || current.isOffline) break;
        const batch = await compressExistingImages(current.accessToken, cursor.current);
        if (!mounted.current) return;
        setTotals(previous => ({
          compressed: previous.compressed + batch.compressed,
          skipped: previous.skipped + batch.skipped,
          failed: previous.failed + batch.failed,
          bytesSaved: previous.bytesSaved + batch.bytesSaved,
        }));
        if (!batch.hasMore) {
          setStatus('complete');
          return;
        }
        if (!batch.nextAfterId || batch.nextAfterId === cursor.current) {
          throw new Error('Der Server hat keinen gültigen Fortschritt zurückgegeben.');
        }
        cursor.current = batch.nextAfterId;
      }
      if (mounted.current) setStatus('paused');
    } catch (error) {
      if (!mounted.current) return;
      setStatus('error');
      if (error instanceof Error && error.name === 'UnauthorizedError') {
        setErrorMessage('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
        await logout();
      } else if (error instanceof HttpStatusError && error.status === 403) {
        setErrorMessage('Nur Admins dürfen Bilder komprimieren.');
      } else {
        setErrorMessage('Der Durchlauf wurde unterbrochen. Prüfe deine Verbindung und versuche es erneut.');
      }
    } finally {
      running.current = false;
      if (mounted.current) setIsPausing(false);
    }
  }

  const labels: Record<Status, string> = {
    idle: 'Bereit', running: isPausing ? 'Wird pausiert …' : 'Bilder werden komprimiert …',
    paused: 'Pausiert', complete: 'Durchlauf abgeschlossen', error: 'Durchlauf unterbrochen',
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Bilder komprimieren</Text>
      <Text style={styles.body}>
        Bereits hochgeladene Bilder mit den aktuellen Einstellungen verkleinern und Datenvolumen sparen.
        Bereits optimierte Bilder werden übersprungen.
      </Text>
      <Text style={styles.body}>
        Lass diese Seite geöffnet. Beim Verlassen oder Wechsel in den Hintergrund pausiert der Durchlauf
        nach dem aktuellen Schritt. Erledigte Bilder bleiben gespeichert.
      </Text>
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Text style={styles.statusLabel}>{labels[status]}</Text>
        {status === 'running' && <ActivityIndicator color="#2e6b4b" />}
      </View>
      {status !== 'idle' && (
        <View style={styles.summary}>
          <Text style={styles.saved}>{(totals.bytesSaved / 1024 / 1024).toFixed(2)} MiB eingespart</Text>
          <Text style={styles.body}>
            {totals.compressed} verkleinert · {totals.skipped} unverändert · {totals.failed} fehlgeschlagen
          </Text>
          {totals.failed > 0 && <Text style={styles.body}>
            Fehlgeschlagene Bilder bleiben erhalten und werden bei einem neuen Durchlauf erneut geprüft.
          </Text>}
        </View>
      )}
      {!!errorMessage && <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text>}
      {!available && <Text style={styles.body}>Nur mit Internetverbindung verfügbar.</Text>}
      {status === 'running' ? (
        <Pressable accessibilityRole="button" disabled={isPausing} style={styles.button}
          onPress={() => { stop.current = true; setIsPausing(true); }}>
          <Text style={styles.buttonLabel}>Pausieren</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" disabled={!available}
          style={[styles.button, !available && styles.disabled]} onPress={() => { void start(); }}>
          <Text style={styles.buttonLabel}>
            {status === 'paused' || status === 'error' ? 'Komprimierung fortsetzen' :
              status === 'complete' ? 'Erneut prüfen' : 'Komprimierung starten'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, backgroundColor: '#ffffff', padding: 14, gap: 10 },
  title: { color: '#1e2a1e', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  body: { color: '#657464', fontSize: 13, lineHeight: 19 },
  status: { backgroundColor: '#eef2eb', padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLabel: { color: '#2f3f2f', fontSize: 13, fontWeight: '600', flex: 1 },
  summary: { gap: 6 },
  saved: { color: '#2e6b4b', fontSize: 18, fontWeight: '700' },
  error: { color: '#a33226', fontSize: 13, lineHeight: 19 },
  button: { minHeight: 48, borderRadius: 24, backgroundColor: '#2e6b4b', alignItems: 'center', justifyContent: 'center', padding: 12 },
  buttonLabel: { color: '#f5f3ee', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
