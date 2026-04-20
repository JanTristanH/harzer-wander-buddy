import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminGuard } from '@/components/admin-guard';
import { SkeletonBlock } from '@/components/skeleton';
import {
  createParkingSpot,
  deleteSpotWithRoutes,
  HttpStatusError,
  searchPlacesByName,
  type AdminParkingSpotMutationInput,
  type ParkingSpot,
  type PlaceSearchResult,
  updateParkingSpot,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { isNetworkUnavailableError, requireOnlineForWrite } from '@/lib/offline-write';
import { queryKeys, useMapDataQuery } from '@/lib/queries';

type Claims = {
  sub?: string;
};

const REMOTE_SEARCH_MIN_LENGTH = 3;
const REMOTE_SEARCH_DEBOUNCE_MS = 320;
const FALLBACK_REGION: Region = {
  latitude: 51.7544,
  longitude: 10.6182,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16,
};
const MAP_FOCUS_DELTA = 0.012;
const COORDINATE_PRECISION = 6;

function normalizedText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasValidCoordinate(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null;
}

function createRegion(latitude: number, longitude: number, delta = MAP_FOCUS_DELTA): Region {
  return {
    latitude,
    longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

function hasMeaningfulParkingChange(
  current: ParkingSpot,
  nextPayload: Partial<AdminParkingSpotMutationInput>
) {
  if ('name' in nextPayload && normalizedText(nextPayload.name) !== normalizedText(current.name)) {
    return true;
  }

  if (
    'description' in nextPayload &&
    normalizedText(nextPayload.description) !== normalizedText(current.description)
  ) {
    return true;
  }

  if ('image' in nextPayload && normalizedText(nextPayload.image) !== normalizedText(current.image)) {
    return true;
  }

  if ('latitude' in nextPayload) {
    const currentLatitude =
      typeof current.latitude === 'number' && Number.isFinite(current.latitude) ? current.latitude : null;
    if (currentLatitude === null || Math.abs(currentLatitude - nextPayload.latitude!) > 0.0000001) {
      return true;
    }
  }

  if ('longitude' in nextPayload) {
    const currentLongitude =
      typeof current.longitude === 'number' && Number.isFinite(current.longitude) ? current.longitude : null;
    if (currentLongitude === null || Math.abs(currentLongitude - nextPayload.longitude!) > 0.0000001) {
      return true;
    }
  }

  return false;
}

export default function AdminParkingEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const parkingIdParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const isCreateMode = (parkingIdParam || '').toLocaleLowerCase() === 'new';
  const claims = useIdTokenClaims<Claims>();
  const queryClient = useQueryClient();
  const { accessToken, canPerformWrites, isOffline, logout } = useAuth();
  const { data, error, isPending, refetch } = useMapDataQuery();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrlText, setImageUrlText] = useState('');
  const [latitudeText, setLatitudeText] = useState('');
  const [longitudeText, setLongitudeText] = useState('');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationResults, setLocationResults] = useState<PlaceSearchResult[]>([]);
  const [isLocationSearchLoading, setIsLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const initializedParkingIdRef = useRef<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const lastMapCoordinateRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const editedParking = useMemo(() => {
    if (isCreateMode || !parkingIdParam) {
      return null;
    }

    return data?.parkingSpots.find((parking) => parking.ID === parkingIdParam) ?? null;
  }, [data?.parkingSpots, isCreateMode, parkingIdParam]);

  useEffect(() => {
    if (isCreateMode) {
      if (initializedParkingIdRef.current === 'new') {
        return;
      }

      initializedParkingIdRef.current = 'new';
      setName('');
      setDescription('');
      setImageUrlText('');
      setLatitudeText('');
      setLongitudeText('');
      return;
    }

    if (!editedParking) {
      return;
    }

    if (initializedParkingIdRef.current === editedParking.ID) {
      return;
    }

    initializedParkingIdRef.current = editedParking.ID;
    setName(normalizedText(editedParking.name));
    setDescription(normalizedText(editedParking.description));
    setImageUrlText(normalizedText(editedParking.image));
    setLatitudeText(
      typeof editedParking.latitude === 'number' && Number.isFinite(editedParking.latitude)
        ? String(editedParking.latitude)
        : ''
    );
    setLongitudeText(
      typeof editedParking.longitude === 'number' && Number.isFinite(editedParking.longitude)
        ? String(editedParking.longitude)
        : ''
    );
  }, [editedParking, isCreateMode]);

  useEffect(() => {
    if (!accessToken) {
      setLocationResults([]);
      setLocationSearchError(null);
      setIsLocationSearchLoading(false);
      return;
    }

    const query = locationSearchQuery.trim();
    if (query.length < REMOTE_SEARCH_MIN_LENGTH) {
      setLocationResults([]);
      setLocationSearchError(null);
      setIsLocationSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      void (async () => {
        setIsLocationSearchLoading(true);
        setLocationSearchError(null);

        try {
          const latitude = toNullableNumber(latitudeText) ?? undefined;
          const longitude = toNullableNumber(longitudeText) ?? undefined;
          const nextResults = await searchPlacesByName(accessToken, {
            query,
            latitude,
            longitude,
            limit: 8,
          });

          if (cancelled) {
            return;
          }

          setLocationResults(nextResults);
          setLocationSearchError(null);
        } catch (nextError) {
          if (cancelled) {
            return;
          }

          if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
            await logout();
            return;
          }

          setLocationResults([]);
          setLocationSearchError('Orte konnten nicht geladen werden.');
        } finally {
          if (!cancelled) {
            setIsLocationSearchLoading(false);
          }
        }
      })();
    }, REMOTE_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [accessToken, latitudeText, locationSearchQuery, longitudeText, logout]);

  const parsedLatitude = useMemo(() => toNullableNumber(latitudeText), [latitudeText]);
  const parsedLongitude = useMemo(() => toNullableNumber(longitudeText), [longitudeText]);
  const hasValidMapCoordinate = hasValidCoordinate(parsedLatitude, parsedLongitude);
  const currentMapCoordinate = useMemo(
    () => {
      if (parsedLatitude === null || parsedLongitude === null) {
        return null;
      }

      return {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      };
    },
    [parsedLatitude, parsedLongitude]
  );

  const mapRegion = useMemo(() => {
    if (currentMapCoordinate) {
      return createRegion(currentMapCoordinate.latitude, currentMapCoordinate.longitude);
    }

    return FALLBACK_REGION;
  }, [currentMapCoordinate]);

  useEffect(() => {
    if (!currentMapCoordinate) {
      lastMapCoordinateRef.current = null;
      return;
    }

    const nextCoordinate = currentMapCoordinate;
    const previousCoordinate = lastMapCoordinateRef.current;

    if (
      previousCoordinate &&
      Math.abs(previousCoordinate.latitude - nextCoordinate.latitude) < 0.0000001 &&
      Math.abs(previousCoordinate.longitude - nextCoordinate.longitude) < 0.0000001
    ) {
      return;
    }

    lastMapCoordinateRef.current = nextCoordinate;
    mapRef.current?.animateToRegion(createRegion(nextCoordinate.latitude, nextCoordinate.longitude), 220);
  }, [currentMapCoordinate]);

  const updateCoordinates = useCallback((latitude: number, longitude: number) => {
    setLatitudeText(latitude.toFixed(COORDINATE_PRECISION));
    setLongitudeText(longitude.toFixed(COORDINATE_PRECISION));
  }, []);

  const handleMapCoordinateChange = useCallback(
    ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      updateCoordinates(latitude, longitude);
    },
    [updateCoordinates]
  );

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      handleMapCoordinateChange(event.nativeEvent.coordinate);
    },
    [handleMapCoordinateChange]
  );

  const validateInputs = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Titel ist erforderlich.');
    }

    const latitude = toNullableNumber(latitudeText);
    const longitude = toNullableNumber(longitudeText);
    if (latitude === null || longitude === null) {
      throw new Error('Latitude und Longitude muessen gueltige Zahlen sein.');
    }

    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitude muss zwischen -90 und 90 liegen.');
    }

    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitude muss zwischen -180 und 180 liegen.');
    }

    return {
      name: trimmedName,
      description: description.trim() || undefined,
      image: imageUrlText.trim() || undefined,
      latitude,
      longitude,
    } satisfies AdminParkingSpotMutationInput;
  }, [description, imageUrlText, latitudeText, longitudeText, name]);

  const invalidateAdminQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.mapData(claims?.sub) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.parkingDetail(claims?.sub, parkingIdParam) }),
    ]);
  }, [claims?.sub, parkingIdParam, queryClient]);

  const handleSave = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    if (!canPerformWrites || isOffline) {
      Alert.alert('Offline', 'Admin-Aenderungen sind nur online verfuegbar.');
      return;
    }

    setIsSaving(true);

    try {
      requireOnlineForWrite(canPerformWrites, 'Admin-Aenderungen sind nur online verfuegbar.');
      const nextPayload = validateInputs();

      if (isCreateMode) {
        const createdParking = await createParkingSpot(accessToken, nextPayload);
        await invalidateAdminQueries();

        Alert.alert('Gespeichert', 'Neuer Parkplatz wurde angelegt.', [
          {
            text: 'OK',
            onPress: () => {
              if (createdParking?.ID) {
                router.replace(`/admin/parking/${createdParking.ID}` as never);
              } else {
                router.back();
              }
            },
          },
        ]);
        return;
      }

      if (!editedParking || !parkingIdParam) {
        throw new Error('Parkplatz konnte nicht geladen werden.');
      }

      const updatePayload: Partial<AdminParkingSpotMutationInput> = {
        name: nextPayload.name,
        description: nextPayload.description,
        image: nextPayload.image,
        latitude: nextPayload.latitude,
        longitude: nextPayload.longitude,
      };

      if (!hasMeaningfulParkingChange(editedParking, updatePayload)) {
        Alert.alert('Keine Aenderung', 'Es wurden keine Unterschiede erkannt.');
        return;
      }

      await updateParkingSpot(accessToken, parkingIdParam, updatePayload);
      await invalidateAdminQueries();
      Alert.alert('Gespeichert', 'Parkplatz wurde aktualisiert.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        await logout();
        return;
      }

      if (nextError instanceof HttpStatusError) {
        if (nextError.status === 403) {
          Alert.alert('Keine Berechtigung', 'Nur Admins duerfen Parkplaetze bearbeiten.');
          return;
        }

        if (nextError.status === 405) {
          Alert.alert(
            'Backend nicht freigeschaltet',
            'Das Backend erlaubt diese Aktion aktuell noch nicht.'
          );
          return;
        }
      }

      Alert.alert('Fehler beim Speichern', nextError instanceof Error ? nextError.message : 'Unbekannter Fehler');
    } finally {
      setIsSaving(false);
    }
  }, [
    accessToken,
    canPerformWrites,
    editedParking,
    invalidateAdminQueries,
    isCreateMode,
    isOffline,
    logout,
    parkingIdParam,
    router,
    validateInputs,
  ]);

  const handleDelete = useCallback(async () => {
    if (!accessToken || !parkingIdParam || isCreateMode) {
      return;
    }

    if (!canPerformWrites || isOffline) {
      Alert.alert('Offline', 'Admin-Aenderungen sind nur online verfuegbar.');
      return;
    }

    Alert.alert(
      'Parkplatz loeschen',
      'Der Parkplatz und seine zugehoerigen Routen werden entfernt. Dies kann nicht rueckgaengig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Loeschen',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsDeleting(true);
              try {
                await deleteSpotWithRoutes(accessToken, parkingIdParam);
                await invalidateAdminQueries();
                Alert.alert('Geloescht', 'Parkplatz inklusive Routen wurde entfernt.', [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/admin/parking' as never),
                  },
                ]);
              } catch (nextError) {
                if (isNetworkUnavailableError(nextError)) {
                  Alert.alert('Offline', nextError.message);
                  return;
                }

                if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
                  await logout();
                  return;
                }

                if (nextError instanceof HttpStatusError && nextError.status === 403) {
                  Alert.alert('Keine Berechtigung', 'Nur Admins duerfen Parkplaetze loeschen.');
                  return;
                }

                Alert.alert(
                  'Fehler beim Loeschen',
                  nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
                );
              } finally {
                setIsDeleting(false);
              }
            })();
          },
        },
      ]
    );
  }, [
    accessToken,
    canPerformWrites,
    invalidateAdminQueries,
    isCreateMode,
    isOffline,
    logout,
    parkingIdParam,
    router,
  ]);

  const locationSearchHint = useMemo(() => {
    if (locationSearchQuery.trim().length < REMOTE_SEARCH_MIN_LENGTH) {
      return `Mindestens ${REMOTE_SEARCH_MIN_LENGTH} Zeichen fuer Ortssuche eingeben.`;
    }

    if (isLocationSearchLoading) {
      return 'Suche Orte...';
    }

    if (locationSearchError) {
      return locationSearchError;
    }

    if (locationResults.length === 0) {
      return 'Keine Orte gefunden.';
    }

    return null;
  }, [isLocationSearchLoading, locationResults.length, locationSearchError, locationSearchQuery]);

  const showNotFound = !isCreateMode && !isPending && !editedParking;

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
              <Text style={styles.title}>{isCreateMode ? 'Neuer Parkplatz' : 'Parkplatz bearbeiten'}</Text>
              <Text style={styles.subtitle}>Pflicht: Titel + Latitude/Longitude.</Text>
            </View>
          </View>

          {isPending ? (
            <View style={styles.skeletonWrap}>
              <SkeletonBlock height={52} radius={14} width="100%" />
              <SkeletonBlock height={120} radius={14} width="100%" />
              <SkeletonBlock height={52} radius={14} width="100%" />
              <SkeletonBlock height={52} radius={14} width="100%" />
            </View>
          ) : showNotFound ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Parkplatz nicht gefunden</Text>
              <Text style={styles.errorBody}>
                Der angeforderte Parkplatz ist nicht in den geladenen Daten enthalten.
              </Text>
              <Pressable
                onPress={() => {
                  void refetch();
                }}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonLabel}>Erneut laden</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.fieldCard}>
                <Text style={styles.fieldLabel}>Titel *</Text>
                <TextInput
                  autoCapitalize="sentences"
                  autoCorrect
                  onChangeText={setName}
                  placeholder="Name des Parkplatzes"
                  placeholderTextColor="#6b7a6b"
                  style={styles.input}
                  value={name}
                />

                <Text style={styles.fieldLabel}>Beschreibung</Text>
                <TextInput
                  autoCapitalize="sentences"
                  multiline
                  onChangeText={setDescription}
                  placeholder="Kurze Beschreibung"
                  placeholderTextColor="#6b7a6b"
                  style={[styles.input, styles.textArea]}
                  textAlignVertical="top"
                  value={description}
                />

                <Text style={styles.fieldLabel}>Bild URL</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onChangeText={setImageUrlText}
                  placeholder="https://..."
                  placeholderTextColor="#6b7a6b"
                  style={styles.input}
                  value={imageUrlText}
                />
              </View>

              <View style={styles.fieldCard}>
                <Text style={styles.fieldCardTitle}>Location</Text>
                <Text style={styles.fieldHint}>Marker ziehen oder auf die Karte tippen, um die Position zu setzen.</Text>

                <View style={styles.mapCard}>
                  <MapView
                    initialRegion={mapRegion}
                    onPress={handleMapPress}
                    ref={mapRef}
                    rotateEnabled={false}
                    scrollEnabled
                    style={styles.map}
                    toolbarEnabled={false}>
                    {currentMapCoordinate ? (
                      <Marker
                        coordinate={currentMapCoordinate}
                        draggable
                        onDragEnd={(event) => handleMapCoordinateChange(event.nativeEvent.coordinate)}
                        pinColor="#2e6b4b"
                      />
                    ) : null}
                  </MapView>
                  {!hasValidMapCoordinate ? (
                    <View pointerEvents="none" style={styles.mapOverlay}>
                      <Text style={styles.mapOverlayTitle}>Koordinaten fehlen</Text>
                      <Text style={styles.mapOverlayBody}>
                        Gib Latitude und Longitude ein oder nutze die Ortssuche.
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.fieldLabel}>Ort suchen</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  onChangeText={setLocationSearchQuery}
                  placeholder="Ort oder Adresse suchen"
                  placeholderTextColor="#6b7a6b"
                  style={styles.input}
                  value={locationSearchQuery}
                />
                {locationSearchHint ? <Text style={styles.locationHint}>{locationSearchHint}</Text> : null}

                {locationResults.length > 0 ? (
                  <View style={styles.locationResultList}>
                    {locationResults.map((result) => (
                      <Pressable
                        key={result.placeId}
                        onPress={() => {
                          updateCoordinates(result.latitude, result.longitude);
                          setLocationSearchQuery(result.name);
                          setLocationResults([]);
                        }}
                        style={({ pressed }) => [styles.locationResultRow, pressed && styles.pressed]}>
                        <Text numberOfLines={1} style={styles.locationResultTitle}>
                          {result.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.locationResultMeta}>
                          {result.formattedAddress}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <View style={styles.coordinateRow}>
                  <View style={styles.coordinateField}>
                    <Text style={styles.fieldLabel}>Latitude *</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="decimal-pad"
                      onChangeText={setLatitudeText}
                      placeholder="51.75440"
                      placeholderTextColor="#6b7a6b"
                      style={styles.input}
                      value={latitudeText}
                    />
                  </View>
                  <View style={styles.coordinateField}>
                    <Text style={styles.fieldLabel}>Longitude *</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="decimal-pad"
                      onChangeText={setLongitudeText}
                      placeholder="10.61820"
                      placeholderTextColor="#6b7a6b"
                      style={styles.input}
                      value={longitudeText}
                    />
                  </View>
                </View>
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Hinweis</Text>
                  <Text style={styles.errorBody}>{error.message}</Text>
                </View>
              ) : null}

              {!isCreateMode ? (
                <Pressable
                  disabled={isDeleting}
                  onPress={() => {
                    void handleDelete();
                  }}
                  style={({ pressed }) => [
                    styles.destructiveButton,
                    isDeleting && styles.destructiveButtonDisabled,
                    pressed && !isDeleting && styles.pressed,
                  ]}>
                  {isDeleting ? (
                    <ActivityIndicator color="#fff5f3" size="small" />
                  ) : (
                    <>
                      <Feather color="#fff5f3" name="trash-2" size={15} />
                      <Text style={styles.destructiveButtonLabel}>Parkplatz mit Routen loeschen</Text>
                    </>
                  )}
                </Pressable>
              ) : null}

              <Pressable
                disabled={isSaving}
                onPress={() => {
                  void handleSave();
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  isSaving && styles.primaryButtonDisabled,
                  pressed && !isSaving && styles.pressed,
                ]}>
                {isSaving ? (
                  <ActivityIndicator color="#f5f3ee" size="small" />
                ) : (
                  <>
                    <Feather color="#f5f3ee" name="save" size={15} />
                    <Text style={styles.primaryButtonLabel}>
                      {isCreateMode ? 'Parkplatz anlegen' : 'Aenderungen speichern'}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          )}
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
    paddingBottom: 220,
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
  fieldCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  fieldCardTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  fieldHint: {
    color: '#657464',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  mapCard: {
    marginTop: 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d8d4cc',
    backgroundColor: '#eef2eb',
  },
  map: {
    height: 260,
    width: '100%',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(245,243,238,0.72)',
    gap: 6,
  },
  mapOverlayTitle: {
    color: '#1e2a1e',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  mapOverlayBody: {
    color: '#657464',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
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
  textArea: {
    minHeight: 92,
  },
  coordinateRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  coordinateField: {
    flex: 1,
    gap: 6,
  },
  locationHint: {
    color: '#657464',
    fontSize: 12,
    lineHeight: 16,
  },
  locationResultList: {
    gap: 8,
  },
  locationResultRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8d4cc',
    backgroundColor: '#fbfaf7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  locationResultTitle: {
    color: '#1e2a1e',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  locationResultMeta: {
    color: '#657464',
    fontSize: 12,
    lineHeight: 16,
  },
  skeletonWrap: {
    gap: 10,
    paddingTop: 4,
  },
  primaryButton: {
    minHeight: 48,
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
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cfd7cc',
    backgroundColor: '#f6f7f2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonLabel: {
    color: '#2e6b4b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  destructiveButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#9f4339',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  destructiveButtonDisabled: {
    opacity: 0.7,
  },
  destructiveButtonLabel: {
    color: '#fff5f3',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  errorCard: {
    borderRadius: 16,
    backgroundColor: '#f8ebe8',
    borderWidth: 1,
    borderColor: '#e3c8c2',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  errorTitle: {
    color: '#6d2f2a',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  errorBody: {
    color: '#8a4a42',
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.84,
  },
});
