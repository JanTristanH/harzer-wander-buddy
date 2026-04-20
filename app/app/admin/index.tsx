import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminGuard } from '@/components/admin-guard';
import {
  addElevationToAllTravelTimes,
  calculateTravelTimesNNearestNeighbors,
  getMissingTravelTimesCount,
  HttpStatusError,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isNetworkUnavailableError } from '@/lib/offline-write';

function normalizePositiveInteger(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const { accessToken, canPerformWrites, isOffline, logout } = useAuth();
  const [neighborCountText, setNeighborCountText] = useState('4');
  const [missingCount, setMissingCount] = useState<number | null>(null);
  const [isRefreshingMissingCount, setIsRefreshingMissingCount] = useState(false);
  const [isCalculatingRoutes, setIsCalculatingRoutes] = useState(false);
  const [isAddingElevation, setIsAddingElevation] = useState(false);

  const neighborCount = useMemo(() => normalizePositiveInteger(neighborCountText), [neighborCountText]);

  const handleServiceError = useCallback(
    async (error: unknown) => {
      if (isNetworkUnavailableError(error)) {
        Alert.alert('Offline', error.message);
        return true;
      }

      if (error instanceof Error && error.name === 'UnauthorizedError') {
        await logout();
        return true;
      }

      if (error instanceof HttpStatusError && error.status === 403) {
        Alert.alert('Keine Berechtigung', 'Nur Admins duerfen diese Backend-Jobs starten.');
        return true;
      }

      return false;
    },
    [logout]
  );

  const refreshMissingCount = useCallback(async () => {
    if (!accessToken || isOffline || !canPerformWrites) {
      return;
    }

    setIsRefreshingMissingCount(true);
    try {
      const nextCount = await getMissingTravelTimesCount(accessToken, neighborCount ?? undefined);
      setMissingCount(nextCount);
    } catch (error) {
      if (await handleServiceError(error)) {
        return;
      }

      Alert.alert(
        'Fehler beim Laden',
        error instanceof Error ? error.message : 'Fehlende Routen konnten nicht geladen werden.'
      );
    } finally {
      setIsRefreshingMissingCount(false);
    }
  }, [accessToken, canPerformWrites, handleServiceError, isOffline, neighborCount]);

  useEffect(() => {
    void refreshMissingCount();
  }, [refreshMissingCount]);

  const handleCalculateMissingRoutes = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    if (neighborCount === null) {
      Alert.alert('Ungueltiger Wert', 'Bitte eine positive Anzahl an Nachbarn eingeben.');
      return;
    }

    if (isOffline || !canPerformWrites) {
      Alert.alert('Offline', 'Admin-Jobs sind nur online verfuegbar.');
      return;
    }

    setIsCalculatingRoutes(true);
    try {
      const createdCount = await calculateTravelTimesNNearestNeighbors(accessToken, neighborCount);
      await refreshMissingCount();
      Alert.alert(
        'Berechnung gestartet',
        `${createdCount} TravelTimes wurden fuer die ${neighborCount} naechsten Nachbarn berechnet.`
      );
    } catch (error) {
      if (await handleServiceError(error)) {
        return;
      }

      Alert.alert(
        'Fehler bei der Routenberechnung',
        error instanceof Error ? error.message : 'Der Backend-Call ist fehlgeschlagen.'
      );
    } finally {
      setIsCalculatingRoutes(false);
    }
  }, [accessToken, canPerformWrites, handleServiceError, isOffline, neighborCount, refreshMissingCount]);

  const handleAddElevation = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    if (isOffline || !canPerformWrites) {
      Alert.alert('Offline', 'Admin-Jobs sind nur online verfuegbar.');
      return;
    }

    setIsAddingElevation(true);
    try {
      const responseMessage = await addElevationToAllTravelTimes(accessToken);
      await refreshMissingCount();
      Alert.alert('Hoehenmeter aktualisiert', responseMessage || 'Der Backend-Call wurde ausgefuehrt.');
    } catch (error) {
      if (await handleServiceError(error)) {
        return;
      }

      Alert.alert(
        'Fehler beim Elevation-Job',
        error instanceof Error ? error.message : 'Der Backend-Call ist fehlgeschlagen.'
      );
    } finally {
      setIsAddingElevation(false);
    }
  }, [accessToken, canPerformWrites, handleServiceError, isOffline, refreshMissingCount]);

  return (
    <AdminGuard>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Feather color="#1e2a1e" name="arrow-left" size={16} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Admin</Text>
              <Text style={styles.subtitle}>Stempelstellen, Parkplaetze und Backend-Jobs zentral verwalten.</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Daten pflegen</Text>
            <Pressable
              onPress={() => router.push('/admin/stamps' as never)}
              style={({ pressed }) => [styles.navCard, pressed && styles.pressed]}>
              <View style={styles.navCopy}>
                <Text style={styles.navTitle}>Stempelstellen</Text>
                <Text style={styles.navBody}>Anlegen und bestehende Stempelstellen bearbeiten.</Text>
              </View>
              <Feather color="#2e6b4b" name="chevron-right" size={18} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/admin/parking' as never)}
              style={({ pressed }) => [styles.navCard, pressed && styles.pressed]}>
              <View style={styles.navCopy}>
                <Text style={styles.navTitle}>Parkplaetze</Text>
                <Text style={styles.navBody}>Parkplaetze anlegen, bearbeiten und mitsamt Routen loeschen.</Text>
              </View>
              <Feather color="#2e6b4b" name="chevron-right" size={18} />
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>TravelTime Service</Text>
            <Text style={styles.fieldLabel}>Naechste Nachbarn (`n`)</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setNeighborCountText}
              placeholder="4"
              placeholderTextColor="#6b7a6b"
              style={styles.input}
              value={neighborCountText}
            />

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Fehlende Routen</Text>
              {isRefreshingMissingCount ? (
                <ActivityIndicator color="#2e6b4b" size="small" />
              ) : (
                <Text style={styles.statusValue}>{missingCount === null ? 'unbekannt' : String(missingCount)}</Text>
              )}
            </View>

            <Pressable
              onPress={() => {
                void refreshMissingCount();
              }}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonLabel}>Fehlende Routen neu zaehlen</Text>
            </Pressable>

            <Pressable
              disabled={isCalculatingRoutes}
              onPress={() => {
                void handleCalculateMissingRoutes();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                isCalculatingRoutes && styles.primaryButtonDisabled,
                pressed && !isCalculatingRoutes && styles.pressed,
              ]}>
              {isCalculatingRoutes ? (
                <ActivityIndicator color="#f5f3ee" size="small" />
              ) : (
                <>
                  <Feather color="#f5f3ee" name="repeat" size={15} />
                  <Text style={styles.primaryButtonLabel}>Fehlende Routen berechnen</Text>
                </>
              )}
            </Pressable>

            <Pressable
              disabled={isAddingElevation}
              onPress={() => {
                void handleAddElevation();
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                isAddingElevation && styles.secondaryButtonDisabled,
                pressed && !isAddingElevation && styles.pressed,
              ]}>
              {isAddingElevation ? (
                <ActivityIndicator color="#2e6b4b" size="small" />
              ) : (
                <Text style={styles.secondaryButtonLabel}>Hoehenmeter zu allen Routen hinzufuegen</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 180,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#f0e9dd',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#1e2a1e',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  subtitle: {
    color: '#657464',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  navCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8d4cc',
    backgroundColor: '#fbfaf7',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navCopy: {
    flex: 1,
    gap: 4,
  },
  navTitle: {
    color: '#1e2a1e',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  navBody: {
    color: '#657464',
    fontSize: 12,
    lineHeight: 16,
  },
  fieldLabel: {
    color: '#2f3f2f',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8d4cc',
    backgroundColor: '#fbfaf7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1e2a1e',
    fontSize: 14,
    lineHeight: 20,
  },
  statusRow: {
    borderRadius: 14,
    backgroundColor: '#eef2eb',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: '#2f3f2f',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  statusValue: {
    color: '#2e6b4b',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#2e6b4b',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonLabel: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cfd7cc',
    backgroundColor: '#f6f7f2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonDisabled: {
    opacity: 0.7,
  },
  secondaryButtonLabel: {
    color: '#2e6b4b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.84,
  },
});
