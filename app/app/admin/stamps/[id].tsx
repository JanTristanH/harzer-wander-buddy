import { Feather } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminGuard } from '@/components/admin-guard';
import { SkeletonBlock } from '@/components/skeleton';
import {
  createStampbox,
  HttpStatusError,
  searchPlacesByName,
  type PlaceSearchResult,
  type Stampbox,
  updateStampbox,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { isNetworkUnavailableError, requireOnlineForWrite } from '@/lib/offline-write';
import { queryKeys, useStampDetailQuery, useStampsOverviewQuery } from '@/lib/queries';

type Claims = {
  sub?: string;
};
type DateFieldKey = 'validFrom' | 'validTo';

const REMOTE_SEARCH_MIN_LENGTH = 3;
const REMOTE_SEARCH_DEBOUNCE_MS = 320;
const MAX_VALID_TO_ISO = '2037-12-31T23:00:01.000Z';
const MAX_VALID_TO_DATE_KEY = '2037-12-31';
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

function dateKeyFromUnknown(value: unknown) {
  const raw = normalizedText(value);
  if (!raw) {
    return '';
  }

  const prefix = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (prefix) {
    return `${prefix[1]}-${prefix[2]}-${prefix[3]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseApiDateOnly(value?: string) {
  const key = dateKeyFromUnknown(value);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = key.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(value: Date | null) {
  if (!value) {
    return 'Nicht gesetzt';
  }

  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();
  return `${day}.${month}.${year}`;
}

function toApiDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00Z`;
}

function toApiValidTo(value: Date) {
  const dateOnly = toApiDateOnly(value);
  if (dateKeyFromUnknown(dateOnly) === MAX_VALID_TO_DATE_KEY) {
    return MAX_VALID_TO_ISO;
  }

  return dateOnly;
}

function hasMeaningfulStampChange(current: Stampbox, nextPayload: Parameters<typeof updateStampbox>[2]) {
  if ('name' in nextPayload && normalizedText(nextPayload.name) !== normalizedText(current.name)) {
    return true;
  }

  if (
    'description' in nextPayload &&
    normalizedText(nextPayload.description) !== normalizedText(current.description)
  ) {
    return true;
  }

  if (
    'heroImageUrl' in nextPayload &&
    normalizedText(nextPayload.heroImageUrl) !== normalizedText(current.heroImageUrl)
  ) {
    return true;
  }

  if (
    'imageCaption' in nextPayload &&
    normalizedText(nextPayload.imageCaption) !== normalizedText(current.imageCaption)
  ) {
    return true;
  }

  if ('validFrom' in nextPayload && dateKeyFromUnknown(nextPayload.validFrom) !== dateKeyFromUnknown(current.validFrom)) {
    return true;
  }

  if ('validTo' in nextPayload && dateKeyFromUnknown(nextPayload.validTo) !== dateKeyFromUnknown(current.validTo)) {
    return true;
  }

  if ('number' in nextPayload && normalizedText(nextPayload.number) !== normalizedText(current.number)) {
    return true;
  }

  if ('orderBy' in nextPayload && normalizedText(nextPayload.orderBy) !== normalizedText(current.orderBy)) {
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

export default function AdminStampEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const stampIdParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const isCreateMode = (stampIdParam || '').toLocaleLowerCase() === 'new';
  const claims = useIdTokenClaims<Claims>();
  const queryClient = useQueryClient();
  const { accessToken, canPerformWrites, isOffline, logout } = useAuth();
  const {
    data: overviewData,
    error: overviewError,
    isPending: isOverviewPending,
    refetch: refetchOverview,
  } = useStampsOverviewQuery();
  const {
    data: stampDetailData,
    error: stampDetailError,
    isPending: isStampDetailPending,
    refetch: refetchStampDetail,
  } = useStampDetailQuery(!isCreateMode ? stampIdParam : undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [heroImageUrlText, setHeroImageUrlText] = useState('');
  const [imageCaptionText, setImageCaptionText] = useState('');
  const [validFromDate, setValidFromDate] = useState<Date | null>(null);
  const [validToDate, setValidToDate] = useState<Date | null>(null);
  const [activeDateField, setActiveDateField] = useState<DateFieldKey | null>(null);
  const [latitudeText, setLatitudeText] = useState('');
  const [longitudeText, setLongitudeText] = useState('');
  const [numberText, setNumberText] = useState('');
  const [orderByText, setOrderByText] = useState('');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationResults, setLocationResults] = useState<PlaceSearchResult[]>([]);
  const [isLocationSearchLoading, setIsLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const initializedStampIdRef = useRef<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const lastMapCoordinateRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const editedStamp = useMemo(() => {
    if (isCreateMode || !stampIdParam) {
      return null;
    }

    if (stampDetailData?.stamp?.ID === stampIdParam) {
      return stampDetailData.stamp;
    }

    return overviewData?.stamps.find((stamp) => stamp.ID === stampIdParam) ?? null;
  }, [isCreateMode, overviewData?.stamps, stampDetailData?.stamp, stampIdParam]);

  useEffect(() => {
    if (isCreateMode) {
      if (initializedStampIdRef.current === 'new') {
        return;
      }

      initializedStampIdRef.current = 'new';
      setName('');
      setDescription('');
      setHeroImageUrlText('');
      setImageCaptionText('');
      setValidFromDate(null);
      setValidToDate(parseApiDateOnly(MAX_VALID_TO_ISO));
      setActiveDateField(null);
      setLatitudeText('');
      setLongitudeText('');
      setNumberText('');
      setOrderByText('');
      return;
    }

    if (!editedStamp) {
      return;
    }

    if (initializedStampIdRef.current === editedStamp.ID) {
      return;
    }

    initializedStampIdRef.current = editedStamp.ID;
    setName(normalizedText(editedStamp.name));
    setDescription(normalizedText(editedStamp.description));
    setHeroImageUrlText(normalizedText(editedStamp.heroImageUrl));
    setImageCaptionText(normalizedText(editedStamp.imageCaption));
    setValidFromDate(parseApiDateOnly(editedStamp.validFrom));
    setValidToDate(parseApiDateOnly(editedStamp.validTo));
    setActiveDateField(null);
    setLatitudeText(
      typeof editedStamp.latitude === 'number' && Number.isFinite(editedStamp.latitude)
        ? String(editedStamp.latitude)
        : ''
    );
    setLongitudeText(
      typeof editedStamp.longitude === 'number' && Number.isFinite(editedStamp.longitude)
        ? String(editedStamp.longitude)
        : ''
    );
    setNumberText(normalizedText(editedStamp.number));
    setOrderByText(normalizedText(editedStamp.orderBy));
  }, [editedStamp, isCreateMode]);

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

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setActiveDateField(null);
      }

      if (event.type === 'dismissed' || !selectedDate || !activeDateField) {
        return;
      }

      const nextDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      if (activeDateField === 'validFrom') {
        setValidFromDate(nextDate);
        return;
      }

      setValidToDate(nextDate);
    },
    [activeDateField]
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

    if (validFromDate && validToDate && validFromDate.getTime() > validToDate.getTime()) {
      throw new Error('validFrom darf nicht nach validTo liegen.');
    }

    return {
      name: trimmedName,
      description: description.trim() || undefined,
      heroImageUrl: heroImageUrlText.trim() || undefined,
      imageCaption: imageCaptionText.trim() || undefined,
      validFrom: validFromDate ? toApiDateOnly(validFromDate) : undefined,
      validTo: validToDate ? toApiValidTo(validToDate) : undefined,
      latitude,
      longitude,
      number: numberText.trim() || undefined,
      orderBy: orderByText.trim() || undefined,
    };
  }, [
    description,
    heroImageUrlText,
    imageCaptionText,
    latitudeText,
    longitudeText,
    name,
    numberText,
    orderByText,
    validFromDate,
    validToDate,
  ]);

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
      const baseInvalidate = [
        queryClient.invalidateQueries({ queryKey: queryKeys.stampsOverview(claims?.sub) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminStampsOverview(claims?.sub, 'validToday') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminStampsOverview(claims?.sub, 'all') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mapData(claims?.sub) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profileOverview(claims?.sub) }),
      ];

      if (isCreateMode) {
        const createdStamp = await createStampbox(accessToken, nextPayload);
        await Promise.all(baseInvalidate);

        Alert.alert('Gespeichert', 'Neue Stempelstelle wurde angelegt.', [
          {
            text: 'OK',
            onPress: () => {
              if (createdStamp?.ID) {
                router.replace(`/admin/stamps/${createdStamp.ID}` as never);
              } else {
                router.back();
              }
            },
          },
        ]);
        return;
      }

      if (!editedStamp || !stampIdParam) {
        throw new Error('Stempelstelle konnte nicht geladen werden.');
      }

      const updatePayload: Parameters<typeof updateStampbox>[2] = {
        name: nextPayload.name,
        description: nextPayload.description,
        heroImageUrl: nextPayload.heroImageUrl,
        imageCaption: nextPayload.imageCaption,
        validFrom: nextPayload.validFrom,
        validTo: nextPayload.validTo,
        latitude: nextPayload.latitude,
        longitude: nextPayload.longitude,
        number: nextPayload.number,
        orderBy: nextPayload.orderBy,
      };

      if (!hasMeaningfulStampChange(editedStamp, updatePayload)) {
        Alert.alert('Keine Aenderung', 'Es wurden keine Unterschiede erkannt.');
        return;
      }

      await updateStampbox(accessToken, stampIdParam, updatePayload);
      await Promise.all([
        ...baseInvalidate,
        queryClient.invalidateQueries({
          queryKey: queryKeys.stampDetail(claims?.sub, stampIdParam),
        }),
      ]);
      Alert.alert('Gespeichert', 'Stempelstelle wurde aktualisiert.', [
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
          Alert.alert('Keine Berechtigung', 'Nur Admins duerfen Stempelstellen bearbeiten.');
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
    claims?.sub,
    editedStamp,
    isCreateMode,
    isOffline,
    logout,
    queryClient,
    router,
    stampIdParam,
    validateInputs,
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

  const isPending = isOverviewPending || (!isCreateMode && isStampDetailPending);
  const error = stampDetailError ?? overviewError;
  const showNotFound = !isCreateMode && !isPending && !editedStamp;

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
              <Text style={styles.title}>
                {isCreateMode ? 'Neue Stempelstelle' : 'Stempelstelle bearbeiten'}
              </Text>
              <Text style={styles.subtitle}>
                {isCreateMode
                  ? 'Pflicht: Titel + Latitude/Longitude.'
                  : 'Use Case: Stempelstelle verlegt -> nur Position anpassen und speichern.'}
              </Text>
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
              <Text style={styles.errorTitle}>Stempelstelle nicht gefunden</Text>
              <Text style={styles.errorBody}>
                Die angeforderte Stempelstelle ist nicht in den geladenen Daten enthalten.
              </Text>
              <Pressable
                onPress={() => {
                  void Promise.all([refetchOverview(), refetchStampDetail()]);
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
                  placeholder="Name der Stempelstelle"
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

                <Text style={styles.fieldLabel}>Hero Image URL</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onChangeText={setHeroImageUrlText}
                  placeholder="https://..."
                  placeholderTextColor="#6b7a6b"
                  style={styles.input}
                  value={heroImageUrlText}
                />

                <Text style={styles.fieldLabel}>Hero Image Caption</Text>
                <TextInput
                  autoCapitalize="sentences"
                  multiline
                  onChangeText={setImageCaptionText}
                  placeholder="Optionaler Bildtext (unterstuetzt Markdown)"
                  placeholderTextColor="#6b7a6b"
                  style={[styles.input, styles.textArea]}
                  textAlignVertical="top"
                  value={imageCaptionText}
                />

                <View style={styles.dateRow}>
                  <View style={styles.dateField}>
                    <Text style={styles.fieldLabel}>validFrom</Text>
                    <Pressable
                      onPress={() => setActiveDateField((current) => (current === 'validFrom' ? null : 'validFrom'))}
                      style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
                      <Feather color="#2e6b4b" name="calendar" size={14} />
                      <Text style={styles.dateButtonLabel}>{formatDateLabel(validFromDate)}</Text>
                    </Pressable>
                    <Pressable onPress={() => setValidFromDate(null)} style={({ pressed }) => [pressed && styles.pressed]}>
                      <Text style={styles.dateClearLabel}>Leeren</Text>
                    </Pressable>
                  </View>
                  <View style={styles.dateField}>
                    <Text style={styles.fieldLabel}>validTo</Text>
                    <Pressable
                      onPress={() => setActiveDateField((current) => (current === 'validTo' ? null : 'validTo'))}
                      style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
                      <Feather color="#2e6b4b" name="calendar" size={14} />
                      <Text style={styles.dateButtonLabel}>{formatDateLabel(validToDate)}</Text>
                    </Pressable>
                    <Pressable onPress={() => setValidToDate(null)} style={({ pressed }) => [pressed && styles.pressed]}>
                      <Text style={styles.dateClearLabel}>Leeren</Text>
                    </Pressable>
                  </View>
                </View>

                {activeDateField ? (
                  <DateTimePicker
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    mode="date"
                    onChange={handleDateChange}
                    value={activeDateField === 'validFrom' ? validFromDate ?? new Date() : validToDate ?? new Date()}
                  />
                ) : null}

                <Text style={styles.fieldLabel}>Nummer</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setNumberText}
                  placeholder="z. B. 147"
                  placeholderTextColor="#6b7a6b"
                  style={styles.input}
                  value={numberText}
                />

                <Text style={styles.fieldLabel}>Sortierung (`orderBy`)</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setOrderByText}
                  placeholder="z. B. 0147"
                  placeholderTextColor="#6b7a6b"
                  style={styles.input}
                  value={orderByText}
                />
              </View>

              <View style={styles.fieldCard}>
                <Text style={styles.fieldCardTitle}>Location</Text>
                <Text style={styles.fieldHint}>
                  Für „Stempelstelle verlegt“ reicht es, Latitude und Longitude anzupassen.
                </Text>
                <Text style={styles.fieldHint}>
                  Marker ziehen oder auf die Karte tippen, um die Position direkt zu setzen.
                </Text>

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
                      {isCreateMode ? 'Stempelstelle anlegen' : 'Aenderungen speichern'}
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
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  dateField: {
    flex: 1,
    minWidth: 180,
    gap: 6,
  },
  dateButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8d4cc',
    backgroundColor: '#fbfaf7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButtonLabel: {
    color: '#1e2a1e',
    fontSize: 14,
    lineHeight: 20,
  },
  dateClearLabel: {
    color: '#6b7a6b',
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
  textArea: {
    minHeight: 92,
  },
  coordinateRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8d4cc',
    overflow: 'hidden',
  },
  locationResultRow: {
    backgroundColor: '#fdfcf9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#ece8df',
  },
  locationResultTitle: {
    color: '#1e2a1e',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  locationResultMeta: {
    color: '#657464',
    fontSize: 12,
    lineHeight: 16,
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
    backgroundColor: '#6f8c79',
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
    borderRadius: 12,
    backgroundColor: '#f0e9dd',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  secondaryButtonLabel: {
    color: '#2e3a2e',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
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
  skeletonWrap: {
    gap: 10,
  },
  pressed: {
    opacity: 0.84,
  },
});
