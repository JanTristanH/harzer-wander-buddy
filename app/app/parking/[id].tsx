import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthGuard } from '@/components/auth-guard';
import { CurrentPositionDistanceSection } from '@/components/current-position-distance-section';
import { DetailOverflowMenu } from '@/components/detail-overflow-menu';
import { SkeletonBlock } from '@/components/skeleton';
import { useAdminAccess, useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';
import { useParkingDetailQuery, useRouteToStampFromPositionQuery } from '@/lib/queries';

const WEBSITE_BASE_URL = 'https://www.harzer-wander-buddy.de';
const emptyNearbyStampsIllustration = require('@/assets/images/buddy/telescope.png');

function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude?: number; longitude?: number }
) {
  if (typeof to.latitude !== 'number' || typeof to.longitude !== 'number') {
    return null;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(to.latitude - from.latitude);
  const deltaLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) {
    return '';
  }

  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

function formatDistanceMeters(distanceMeters: number | null) {
  if (distanceMeters === null) {
    return '';
  }

  return formatDistance(distanceMeters / 1000);
}

function formatDuration(durationMinutes: number | null) {
  if (durationMinutes === null) {
    return '';
  }

  return `${durationMinutes} Min`;
}

function formatElevationSummary(elevationGainMeters: number | null, elevationLossMeters: number | null) {
  const parts: string[] = [];

  if (typeof elevationGainMeters === 'number' && Number.isFinite(elevationGainMeters)) {
    parts.push(`↑${Math.round(Math.abs(elevationGainMeters))} m`);
  }

  if (typeof elevationLossMeters === 'number' && Number.isFinite(elevationLossMeters)) {
    parts.push(`↓${Math.round(Math.abs(elevationLossMeters))} m`);
  }

  return parts.length > 0 ? ` • ${parts.join(' ')}` : '';
}

function SkeletonLine({
  width,
  height = 14,
}: {
  width: number | `${number}%`;
  height?: number;
}) {
  return <SkeletonBlock height={height} radius={999} width={width} />;
}

function SkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonBadge} />
      <View style={styles.skeletonColumn}>
        <SkeletonLine width="68%" />
        <SkeletonLine height={12} width="44%" />
      </View>
    </View>
  );
}

function Section({
  title,
  children,
}: React.PropsWithChildren<{
  title: string;
}>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ParkingDetailLoadingState({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.loadingContent} showsVerticalScrollIndicator={false}>
        <View style={styles.loadingHero}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}>
            <Feather color="#1e2a1e" name="arrow-left" size={18} />
          </Pressable>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Parkplatz</Text>
          </View>
        </View>

        <View style={styles.body}>
          <SkeletonBlock height={34} radius={12} tone="strong" width="58%" />
          <View style={styles.descriptionSkeleton}>
            <SkeletonLine width="100%" />
            <SkeletonLine width="82%" />
            <SkeletonLine width="56%" />
          </View>

          <Section title="Stempel in der Nähe">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Section>

          <Section title="Parkplätze in der Nähe">
            <SkeletonRow />
            <SkeletonRow />
          </Section>
        </View>

        <Text style={styles.helperText}>Lade Parkplatz-Details...</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ParkingDetailContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const { accessToken, isOffline } = useAuth();
  const { isAdmin } = useAdminAccess();
  const parkingId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data: detail, error, isFetching, isPending, isPlaceholderData, refetch } =
    useParkingDetailQuery(parkingId);
  const [locationState, setLocationState] = React.useState<'idle' | 'loading' | 'granted' | 'denied'>(
    'idle'
  );
  const [userLocation, setUserLocation] = React.useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const routeToCurrentPositionQuery = useRouteToStampFromPositionQuery(
    parkingId,
    userLocation?.latitude,
    userLocation?.longitude
  );

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/map' as never);
  }

  async function handleStartNavigation() {
    if (!detail?.parking.latitude || !detail?.parking.longitude) {
      Alert.alert('Navigation nicht moeglich', 'Dieser Parkplatz hat keine Koordinaten.');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${detail.parking.latitude},${detail.parking.longitude}`;
    await Linking.openURL(url);
  }

  async function handleRequestRouteToParking() {
    if (!detail?.parking.latitude || !detail?.parking.longitude) {
      return;
    }

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        setUserLocation(null);
        setLocationState(permission.status === 'denied' ? 'denied' : 'idle');
        return;
      }

      setLocationState('loading');
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
      setLocationState('granted');
    } catch {
      setUserLocation(null);
      setLocationState('denied');
    }
  }

  function handleShowOnMap() {
    if (!detail?.parking.ID) {
      return;
    }

    router.push({
      pathname: '/(tabs)/map',
      params: { parkingId: detail.parking.ID },
    } as never);
  }

  async function handleShareParking() {
    if (!detail?.parking.ID) {
      return;
    }

    const shareParams = new URLSearchParams({
      id: detail.parking.ID,
      title: detail.parking.name?.trim() || 'Parkplatz',
      description: detail.parking.description?.trim() || 'Parkplatz im Harz teilen.',
      image: detail.parking.image?.trim() || '',
    });
    const shareUrl = `${WEBSITE_BASE_URL}/share/parking/?${shareParams.toString()}`;

    try {
      await Share.share({
        message: `${detail.parking.name?.trim() || 'Parkplatz'}\n${shareUrl}`,
        title: detail.parking.name?.trim() || 'Parkplatz',
        url: shareUrl,
      });
    } catch (nextError) {
      Alert.alert(
        'Teilen nicht moeglich',
        nextError instanceof Error ? nextError.message : 'Unknown error'
      );
    }
  }

  if (isPending && !detail) {
    return <ParkingDetailLoadingState onBack={handleBack} />;
  }

  if (error && !detail) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Details konnten nicht geladen werden</Text>
          <Text style={styles.helperText}>{error.message}</Text>
          <Pressable
            onPress={() => void refetch()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}>
            <Text style={styles.retryButtonLabel}>Erneut versuchen</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Keine Detaildaten gefunden</Text>
          <Text style={styles.helperText}>Fuer diesen Parkplatz liegen aktuell keine Daten vor.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { parking } = detail;
  const heroImageUri = parking.image?.trim();
  const showDeferredSkeletons = isFetching && isPlaceholderData;
  const isPullRefreshing = isFetching && !isPending;
  const hasParkingCoordinates =
    typeof parking.latitude === 'number' &&
    Number.isFinite(parking.latitude) &&
    typeof parking.longitude === 'number' &&
    Number.isFinite(parking.longitude);
  const offlineRouteToCurrentPosition =
    !isOffline || !userLocation || !hasParkingCoordinates
      ? null
      : (() => {
          const distanceKm = haversineDistanceKm(userLocation, parking);
          const distanceMeters =
            typeof distanceKm === 'number' && Number.isFinite(distanceKm)
              ? Math.max(0, Math.round(distanceKm * 1000))
              : 0;

          return {
            distanceMeters,
            durationSeconds: 0,
            elevationGainMeters: 0,
            elevationLossMeters: 0,
          };
        })();
  const routeToCurrentPosition = routeToCurrentPositionQuery.data ?? offlineRouteToCurrentPosition;
  const hasOfflineRouteFallback =
    routeToCurrentPositionQuery.data == null && offlineRouteToCurrentPosition !== null;
  const isRouteToCurrentPositionLoading =
    locationState === 'loading' ||
    (hasParkingCoordinates &&
      locationState === 'granted' &&
      routeToCurrentPositionQuery.isPending &&
      !hasOfflineRouteFallback);
  const routeToCurrentPositionError = hasOfflineRouteFallback ? null : routeToCurrentPositionQuery.error;
  const routeToCurrentPositionErrorMessage =
    routeToCurrentPositionError instanceof Error
      ? routeToCurrentPositionError.message
      : 'Route konnte noch nicht geladen werden.';
  const bottomInset = Math.max(insets.bottom, 0);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 180 + bottomInset }]}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refetch();
            }}
            refreshing={isPullRefreshing}
            tintColor="#2f7dd7"
          />
        }
        showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#4e88cc', '#78b2e8', '#ddeaf7']} style={styles.hero}>
          {heroImageUri ? (
            <>
              <Image
                cachePolicy="disk"
                contentFit="cover"
                source={buildAuthenticatedImageSource(heroImageUri, accessToken)}
                style={styles.heroImage}
              />
              <View style={styles.heroImageOverlay} />
            </>
          ) : null}

          <Pressable onPress={handleBack} style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}>
            <Feather color="#1e2a1e" name="arrow-left" size={18} />
          </Pressable>

          {isAdmin ? (
            <View style={styles.topRightActions}>
              <DetailOverflowMenu
                actions={[
                  {
                    key: 'edit-parking',
                    label: 'Bearbeiten',
                    icon: 'edit-2',
                    onPress: () => router.push(`/admin/parking/${parking.ID}` as never),
                  },
                ]}
                topOffset={insets.top + 58}
              />
            </View>
          ) : null}

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Parkplatz</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.title}>{parking.name?.trim() || 'Parkplatz'}</Text>
          {parking.description?.trim() ? (
            <Text style={styles.description}>{parking.description.trim()}</Text>
          ) : showDeferredSkeletons ? (
            <View style={styles.descriptionSkeleton}>
              <SkeletonLine width="100%" />
              <SkeletonLine width="82%" />
              <SkeletonLine width="56%" />
            </View>
          ) : (
            <Text style={styles.description}>Keine Beschreibung fuer diesen Parkplatz verfuegbar.</Text>
          )}

          <Section title="Stempel in der Nähe">
            {showDeferredSkeletons ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : detail.nearbyStamps.length > 0 ? (
              detail.nearbyStamps.map((neighbor) => (
                <Pressable
                  key={neighbor.ID}
                  onPress={() => router.push(`/stamps/${neighbor.ID}` as never)}
                  style={({ pressed }) => [styles.rowItem, pressed && styles.rowItemPressed]}>
                  {neighbor.heroImageUrl ? (
                    <Image
                      cachePolicy="disk"
                      contentFit="cover"
                      source={buildAuthenticatedImageSource(neighbor.heroImageUrl, accessToken)}
                      style={styles.rowArtwork}
                    />
                  ) : (
                    <View style={[styles.rowBadge, styles.rowBadgeStamp]}>
                      <Text style={[styles.rowBadgeLabel, styles.rowBadgeLabelStamp]}>
                        {neighbor.number || '--'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {neighbor.number || '--'} {'\u2022'} {neighbor.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {formatDistance(neighbor.distanceKm)}
                      {neighbor.durationMinutes ? ` • ${formatDuration(neighbor.durationMinutes)}` : ''}
                      {formatElevationSummary(neighbor.elevationGainMeters, neighbor.elevationLossMeters)}
                    </Text>
                  </View>
                  <Feather color="#8b957f" name="chevron-right" size={18} />
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyNearbyStampsState}>
                <Image
                  contentFit="contain"
                  source={emptyNearbyStampsIllustration}
                  style={styles.emptyNearbyStampsIllustration}
                />
                <Text style={[styles.emptySectionText, styles.emptyNearbyStampsText]}>
                  Keine Stempel in der Nähe gefunden.
                </Text>
              </View>
            )}
          </Section>

          <Section title="Parkplätze in der Nähe">
            {showDeferredSkeletons ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : detail.nearbyParking.length > 0 ? (
              detail.nearbyParking.map((nearbyParking) => (
                <Pressable
                  key={nearbyParking.ID}
                  onPress={() => router.push(`/parking/${nearbyParking.ID}` as never)}
                  style={({ pressed }) => [styles.rowItem, pressed && styles.rowItemPressed]}>
                  <View style={[styles.rowBadge, styles.rowBadgeParking]}>
                    <Text style={[styles.rowBadgeLabel, styles.rowBadgeLabelParking]}>P</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{nearbyParking.name}</Text>
                    <Text style={styles.rowMeta}>
                      {formatDistance(nearbyParking.distanceKm)}
                      {nearbyParking.durationMinutes ? ` • ${formatDuration(nearbyParking.durationMinutes)}` : ''}
                      {formatElevationSummary(
                        nearbyParking.elevationGainMeters,
                        nearbyParking.elevationLossMeters
                      )}
                    </Text>
                  </View>
                  <Feather color="#8b957f" name="chevron-right" size={18} />
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptySectionText}>Keine Parkplätze in der Nähe gefunden.</Text>
            )}
          </Section>

          <CurrentPositionDistanceSection
            actionLabel="Distanz berechnen"
            errorText={routeToCurrentPositionErrorMessage}
            loadingLineWidths={['72%', '56%']}
            noCoordinatesText="Für diesen Parkplatz liegen keine Koordinaten vor."
            onRequestDistance={() => {
              void handleRequestRouteToParking();
            }}
            promptText="Tippe auf den Button, um die Distanz und Höhenmeter von deinem aktuellen Standort zum Parkplatz zu berechnen."
            retryLabel="Erneut versuchen"
            title="Von aktueller Position"
            status={
              !hasParkingCoordinates
                ? 'no-coordinates'
                : locationState === 'idle'
                  ? 'idle'
                  : locationState === 'denied'
                    ? 'denied'
                    : isRouteToCurrentPositionLoading
                      ? 'loading'
                      : routeToCurrentPositionError
                        ? 'error'
                        : routeToCurrentPosition
                          ? 'ready'
                          : 'error'
            }>
            {routeToCurrentPosition ? (
              <View style={styles.routeSummaryCard}>
                <View style={[styles.rowBadge, styles.rowBadgeRoute]}>
                  <Feather color="#b56928" name="map-pin" size={14} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>Aktuelle Position</Text>
                  <Text style={styles.rowMeta}>
                    {formatDistanceMeters(routeToCurrentPosition.distanceMeters)}
                    {formatElevationSummary(
                      routeToCurrentPosition.elevationGainMeters,
                      routeToCurrentPosition.elevationLossMeters
                    )}
                  </Text>
                </View>
                <Pressable
                  disabled={routeToCurrentPositionQuery.isFetching || isOffline}
                  onPress={() => {
                    if (isOffline) {
                      return;
                    }

                    void routeToCurrentPositionQuery.refetch();
                  }}
                  style={({ pressed }) => [
                    styles.routeRefreshButton,
                    (routeToCurrentPositionQuery.isFetching || isOffline) && styles.routeRefreshButtonDisabled,
                    pressed && styles.sectionActionPressed,
                  ]}>
                  <Feather
                    color="#2e3a2e"
                    name={routeToCurrentPositionQuery.isFetching ? 'refresh-cw' : 'rotate-cw'}
                    size={14}
                  />
                </Pressable>
              </View>
            ) : null}
          </CurrentPositionDistanceSection>
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.bottomDock, { bottom: 18 + bottomInset }]}>
        <View style={styles.bottomActions}>
          <View style={styles.secondaryButtonRow}>
            <Pressable
              onPress={handleStartNavigation}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.secondaryButtonHalf,
                styles.secondaryButtonWithIcon,
                pressed && styles.secondaryButtonPressed,
              ]}>
              <Feather color="#2e3a2e" name="navigation" size={16} />
              <Text style={styles.secondaryButtonLabel}>Navigation starten</Text>
            </Pressable>
            <Pressable
              onPress={handleShowOnMap}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.secondaryButtonHalf,
                styles.secondaryButtonWithIcon,
                pressed && styles.secondaryButtonPressed,
              ]}>
              <Feather color="#2e3a2e" name="map-pin" size={16} />
              <Text style={styles.secondaryButtonLabel}>Auf Karte anzeigen</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => void handleShareParking()}
            style={({ pressed }) => [
              styles.secondaryButton,
              styles.secondaryButtonWithIcon,
              pressed && styles.secondaryButtonPressed,
            ]}>
            <Feather color="#2e3a2e" name="share-2" size={16} />
            <Text style={styles.secondaryButtonLabel}>Parkplatz teilen</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function ParkingDetailScreen() {
  return (
    <AuthGuard>
      <ParkingDetailContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  scrollContent: {
    paddingBottom: 180,
  },
  loadingContent: {
    paddingBottom: 40,
  },
  loadingHero: {
    height: 240,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: '#cad6e3',
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  helperText: {
    color: '#6b7a6b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#1e2a1e',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '700',
  },
  retryButton: {
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: '#2e6b4b',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryButtonPressed: {
    opacity: 0.85,
  },
  retryButtonLabel: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  hero: {
    height: 240,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 28, 22, 0.22)',
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(240,233,221,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topButtonPressed: {
    opacity: 0.88,
  },
  topRightActions: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  heroBadge: {
    position: 'absolute',
    left: 20,
    bottom: 16,
    backgroundColor: '#f5f3ee',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: '#1e2a1e',
    fontSize: 12,
    lineHeight: 16,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  descriptionSkeleton: {
    gap: 8,
  },
  title: {
    color: '#1e2a1e',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'serif',
  },
  description: {
    color: '#445244',
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowItemPressed: {
    opacity: 0.85,
  },
  rowBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowArtwork: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  rowBadgeStamp: {
    backgroundColor: '#e2eee6',
  },
  rowBadgeParking: {
    backgroundColor: '#e3effc',
  },
  rowBadgeRoute: {
    backgroundColor: '#d9e8d3',
  },
  rowBadgeLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowBadgeLabelStamp: {
    color: '#2e6b4b',
  },
  rowBadgeLabelParking: {
    color: '#2f7dd7',
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: '#111111',
    fontSize: 13,
    lineHeight: 16,
  },
  rowMeta: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  emptySectionText: {
    color: '#6b7a6b',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionActionPressed: {
    opacity: 0.85,
  },
  routeSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  routeRefreshButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ea',
  },
  routeRefreshButtonDisabled: {
    opacity: 0.55,
  },
  emptyNearbyStampsState: {
    alignItems: 'center',
    gap: 8,
  },
  emptyNearbyStampsIllustration: {
    width: 120,
    height: 120,
  },
  emptyNearbyStampsText: {
    textAlign: 'center',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skeletonBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ece6db',
  },
  skeletonColumn: {
    flex: 1,
    gap: 8,
  },
  bottomDock: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  bottomActions: {
    gap: 8,
  },
  secondaryButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    height: 45,
    borderRadius: 14,
    backgroundColor: '#e9e2d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonHalf: {
    flex: 1,
  },
  secondaryButtonWithIcon: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryButtonPressed: {
    opacity: 0.9,
  },
  secondaryButtonLabel: {
    color: '#2e3a2e',
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
});
