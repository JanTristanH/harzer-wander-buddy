import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { OfflineMapManager } from '@/components/offline-map-manager';
import { OfflineMapView } from '@/components/maps/offline-map-view';
import { listOfflineMaps, removeOfflineMap, saveOfflineMap } from '@/lib/offline-map-storage';
import { boundsAround, type OfflineMapPack, type OfflineMapProgress, type OFFLINE_MAP_AREAS } from '@/lib/offline-maps';
import { useGuestMapDataQuery, useMapDataQuery } from '@/lib/queries';
import { useAuth } from '@/lib/auth';

export default function OfflineMapsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ latitude?: string; longitude?: string }>();
  const { isAuthenticated } = useAuth();
  const authenticated = useMapDataQuery({ enabled: isAuthenticated });
  const guest = useGuestMapDataQuery({ enabled: !isAuthenticated });
  const stamps = (isAuthenticated ? authenticated : guest).data?.stamps ?? [];
  const [packs, setPacks] = useState<OfflineMapPack[]>([]);
  const [activePack, setActivePack] = useState<OfflineMapPack | null>(null);
  const [progress, setProgress] = useState<OfflineMapProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void listOfflineMaps().then(value => { if (mounted.current) setPacks(value); })
      .catch(() => { if (mounted.current) setError('Gespeicherte Karten konnten nicht gelesen werden.'); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  async function download(area?: typeof OFFLINE_MAP_AREAS[number]) {
    if (controller.current) return;
    const nextController = new AbortController();
    controller.current = nextController;
    setBusy(true); setError(null); setProgress(null);
    try {
      const latitude = area?.latitude ?? Number(params.latitude);
      const longitude = area?.longitude ?? Number(params.longitude);
      const pack = await saveOfflineMap(area?.name ?? 'Mein Kartenausschnitt', boundsAround(latitude, longitude),
        nextController.signal, value => { if (mounted.current) setProgress(value); });
      if (mounted.current) setPacks(current => [pack, ...current]);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Der Download ist fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      controller.current = null;
      if (mounted.current) { setBusy(false); setProgress(null); }
    }
  }
  function confirmDelete(pack: OfflineMapPack) {
    Alert.alert('Offline-Karte löschen?', `${pack.name} wird von diesem Gerät entfernt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { void removeOfflineMap(pack).then(() => {
        setPacks(current => current.filter(item => item.id !== pack.id));
      }).catch(() => setError('Die Karte konnte nicht gelöscht werden.')); } },
    ]);
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#faf9f4' }} edges={['bottom']}>
    <Stack.Screen options={{ title: activePack?.name ?? 'Offline-Karten', headerShown: true }} />
    {Platform.OS === 'web' ? <Text style={{ padding: 24 }}>Offline-Wanderkarten sind in den Android- und iOS-Apps verfügbar.</Text> :
      activePack ? <View style={{ flex: 1 }}>
        <Pressable accessibilityRole="button" onPress={() => setActivePack(null)} style={{ padding: 16 }}><Text>Zurück zu meinen Karten</Text></Pressable>
        <OfflineMapView pack={activePack} stamps={stamps} onStampPress={id => router.push(`/stamps/${id}` as never)} />
      </View> : <OfflineMapManager packs={packs} progress={progress} busy={busy} loading={loading} error={error}
        currentAreaName={params.latitude && params.longitude ? 'Ausschnitt aus meiner Karte herunterladen' : undefined}
        onDownload={area => void download(area)} onOpen={setActivePack} onDelete={confirmDelete}
        onCancel={() => controller.current?.abort()} />}
  </SafeAreaView>;
}
