import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FriendsList, type FriendsListItem } from '@/components/friends-list';
import { Fonts } from '@/constants/theme';
import {
  createFriendRequest,
  searchUsers,
  updateCurrentUserProfile,
  uploadProfileImage,
  type ProfileOverviewData,
  type SearchUserResult,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';
import { type UploadableImage } from '@/lib/image-upload';
import {
  isNetworkUnavailableError,
  OFFLINE_REFRESH_MESSAGE,
  requireOnlineForWrite,
} from '@/lib/offline-write';
import { fetchStampsOverviewData, queryKeys } from '@/lib/queries';

const bearIllustration = require('@/assets/images/onboarding-bear.png');
const PROFILE_AUTO_SAVE_DELAY_MS = 3000;

type LoginClaims = {
  sub?: string;
  given_name?: string;
  name?: string;
  nickname?: string;
  picture?: string;
};

type SentRequestPreview = {
  key: string;
  name: string;
  picture?: string;
};

type SelectedImage = UploadableImage;

type SaveProfileOptions = {
  showValidationAlert?: boolean;
  showErrorAlert?: boolean;
};

type ActionButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
};

type LocationPermissionState = 'unknown' | 'checking' | 'granted' | 'denied';

function getInitialProfileName(rawValue?: string | null) {
  const trimmedValue = (rawValue || '').trim();
  if (!trimmedValue) {
    return '';
  }

  const [valueBeforeAt] = trimmedValue.split('@');
  const normalizedValue = valueBeforeAt.trim();
  return normalizedValue || trimmedValue;
}

function ActionButton({
  label,
  variant = 'secondary',
  disabled,
  style,
  ...props
}: ActionButtonProps) {
  const resolveStyle = (state: PressableStateCallbackType) =>
    typeof style === 'function' ? style(state) : style;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.actionButton,
        variant === 'primary' ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        disabled && styles.actionButtonDisabled,
        state.pressed && !disabled && styles.actionButtonPressed,
        resolveStyle(state),
      ]}
      {...props}>
      <Text
        style={[
          styles.actionButtonLabel,
          variant === 'primary' ? styles.actionButtonLabelPrimary : styles.actionButtonLabelSecondary,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    accessToken,
    authError,
    canPerformWrites,
    configError,
    currentUserProfile,
    hasCompletedOnboarding,
    isOffline,
    isAuthenticated,
    login,
    signup,
    completeOnboarding,
    isLoading,
    logout,
    setCurrentUserProfile,
  } = useAuth();
  const claims = useIdTokenClaims<LoginClaims>();
  const [locationPermission, setLocationPermission] = useState<LocationPermissionState>('unknown');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<SentRequestPreview[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [selectedProfileImage, setSelectedProfileImage] = useState<SelectedImage | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const hasPrefetchedListRef = useRef(false);
  const lastAutoSaveAttemptRef = useRef<string | null>(null);
  const profileSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const normalizedInitialSaveKeyRef = useRef<string | null>(null);
  const matchingCurrentUserProfile =
    claims?.sub && currentUserProfile?.id === claims.sub ? currentUserProfile : null;
  const primaryDisabled = !isAuthenticated || !!configError || isLoading;
  const errorMessage = configError || authError;
  const displayName = claims?.nickname || claims?.name || claims?.given_name || 'Wanderbuddy';
  const fallbackProfileName = getInitialProfileName(
    matchingCurrentUserProfile?.name || claims?.name || claims?.nickname || claims?.given_name || ''
  );
  const claimsNameHasAt = Boolean((claims?.name || '').includes('@'));
  const effectiveProfileName = profileName.trim() || displayName;
  const effectiveProfilePicture = selectedProfileImage?.uri || profilePicture || claims?.picture || null;
  const footerNote = isAuthenticated
    ? 'Du kannst alles später in den Einstellungen ändern.'
    : 'Anmelden erforderlich';
  const locationButtonLabel =
    locationPermission === 'checking'
      ? 'Prüfen...'
      : locationPermission === 'granted'
        ? 'Erlaubt'
        : locationPermission === 'denied'
          ? 'Erneut fragen'
          : 'Erlauben';
  const locationDescription =
    locationPermission === 'granted'
      ? 'Standortfreigabe ist aktiv fuer Entfernungen, Karte und nahe Parkplaetze.'
      : 'Fuer Entfernungen, Karte und nahe Parkplaetze.';
  const bottomDockPadding = Math.max(insets.bottom, 10);
  const scrollBottomPadding = 176 + bottomDockPadding;
  const sentRequestIdSet = useMemo(
    () => new Set(sentRequests.map((request) => request.key)),
    [sentRequests]
  );

  const closeSearchModal = useCallback(() => {
    setIsSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearchLoading(false);
    setSubmittingUserId(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfileName('');
      setProfilePicture(null);
      setSelectedProfileImage(null);
      setProfileSaveError(null);
      return;
    }

    setProfileName(
      getInitialProfileName(
        matchingCurrentUserProfile?.name || claims?.name || claims?.nickname || claims?.given_name || ''
      )
    );
    setProfilePicture(matchingCurrentUserProfile?.picture || claims?.picture || null);
    setProfileSaveError(null);
  }, [
    claims?.given_name,
    claims?.name,
    claims?.nickname,
    claims?.picture,
    matchingCurrentUserProfile?.name,
    matchingCurrentUserProfile?.picture,
    isAuthenticated,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadLocationPermission() {
      try {
        const status = await Location.getForegroundPermissionsAsync();
        if (!isMounted) {
          return;
        }

        setLocationPermission(status.granted ? 'granted' : status.status === 'denied' ? 'denied' : 'unknown');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLocationError(
          error instanceof Error ? error.message : 'Standortberechtigung konnte nicht gelesen werden.'
        );
      }
    }

    void loadLocationPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSearchModalVisible) {
      return;
    }

    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearchLoading(false);
      return;
    }

    if (!accessToken || isOffline) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearchLoading(false);
      return;
    }

    let cancelled = false;
    setIsSearchLoading(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchUsers(accessToken, normalizedQuery);
          if (cancelled) {
            return;
          }

          setSearchResults(results);
          setSearchError(null);
        } catch (error) {
          if (cancelled) {
            return;
          }

          if (error instanceof Error && error.name === 'UnauthorizedError') {
            await logout();
            return;
          }

          setSearchError(error instanceof Error ? error.message : 'Unknown error');
          setSearchResults([]);
        } finally {
          if (!cancelled) {
            setIsSearchLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessToken, isOffline, isSearchModalVisible, logout, searchQuery]);

  useEffect(() => {
    if (!accessToken || !isAuthenticated || hasPrefetchedListRef.current) {
      return;
    }

    hasPrefetchedListRef.current = true;
    let cancelled = false;

    void queryClient
      .prefetchQuery({
        queryKey: queryKeys.stampsOverview(claims?.sub),
        queryFn: () => fetchStampsOverviewData(accessToken, claims?.sub),
      })
      .catch(async (error) => {
        if (cancelled) {
          return;
        }

        if (error instanceof Error && error.name === 'UnauthorizedError') {
          await logout();
          return;
        }

        console.error('Failed to prefetch stamps list after onboarding login', error);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, claims?.sub, isAuthenticated, logout, queryClient]);

  const handlePickProfileImage = useCallback(async () => {
    if (!canPerformWrites) {
      Alert.alert('Offline', 'Profilbilder koennen nur online geaendert werden.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        'Zugriff auf Fotos benoetigt',
        'Bitte erlaube den Zugriff auf deine Fotos, um ein Profilbild auszuwaehlen.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setProfileSaveError(null);
    setSelectedProfileImage({
      uri: asset.uri,
      fileName: asset.fileName || `profile-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    });
  }, [canPerformWrites]);

  const handleSaveProfile = useCallback((options: SaveProfileOptions = {}): Promise<boolean> => {
    if (profileSavePromiseRef.current) {
      return profileSavePromiseRef.current;
    }

    const { showValidationAlert = true, showErrorAlert = true } = options;
    const savePromise = (async () => {
      if (!accessToken || !isAuthenticated) {
        return false;
      }

      const nextName = profileName.trim() || fallbackProfileName;
      if (!nextName) {
        if (showValidationAlert) {
          Alert.alert('Name fehlt', 'Bitte gib einen Namen ein.');
        }
        return false;
      }

      const nextPictureFromState = profilePicture || claims?.picture || undefined;
      const hasNameChange = nextName !== fallbackProfileName;
      const hasNewSelectedImage = !!selectedProfileImage;
      if (!hasNameChange && !hasNewSelectedImage) {
        return true;
      }

      if (!canPerformWrites) {
        setProfileSaveError(OFFLINE_REFRESH_MESSAGE);
        if (showErrorAlert) {
          Alert.alert('Offline', OFFLINE_REFRESH_MESSAGE);
        }
        return false;
      }

      setProfileSaveError(null);
      setIsProfileSaving(true);

      try {
        requireOnlineForWrite(canPerformWrites, 'Profil kann nur online gespeichert werden.');

        let nextPicture = nextPictureFromState;

        if (selectedProfileImage) {
          const uploadedImage = await uploadProfileImage(accessToken, selectedProfileImage);
          nextPicture = uploadedImage.url;
        }

        const updatedProfile = await updateCurrentUserProfile(accessToken, {
          name: nextName,
          picture: nextPicture,
        });

        const resolvedProfile = {
          id: matchingCurrentUserProfile?.id || claims?.sub || nextName,
          name: updatedProfile.name || nextName,
          picture: updatedProfile.picture || nextPicture,
          roles: matchingCurrentUserProfile?.roles,
        };

        setCurrentUserProfile(resolvedProfile);
        queryClient.setQueryData<ProfileOverviewData>(
          queryKeys.profileOverview(claims?.sub),
          (currentProfileOverview) =>
            currentProfileOverview
              ? {
                  ...currentProfileOverview,
                  name: resolvedProfile.name,
                  picture: resolvedProfile.picture,
                }
              : currentProfileOverview
        );
        void queryClient.invalidateQueries({ queryKey: queryKeys.profileOverview(claims?.sub) });
        setProfileName(resolvedProfile.name);
        setProfilePicture(resolvedProfile.picture || null);
        setSelectedProfileImage(null);
        setProfileSaveError(null);
        return true;
      } catch (error) {
        if (isNetworkUnavailableError(error)) {
          setProfileSaveError(error.message);
          if (showErrorAlert) {
            Alert.alert('Offline', error.message);
          }
          return false;
        }

        if (error instanceof Error && error.name === 'UnauthorizedError') {
          await logout();
          return false;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        setProfileSaveError(message);
        if (showErrorAlert) {
          Alert.alert('Profil konnte nicht gespeichert werden', message);
        }
        return false;
      } finally {
        setIsProfileSaving(false);
      }
    })();

    profileSavePromiseRef.current = savePromise;
    void savePromise.finally(() => {
      if (profileSavePromiseRef.current === savePromise) {
        profileSavePromiseRef.current = null;
      }
    });

    return savePromise;
  }, [
    accessToken,
    fallbackProfileName,
    claims?.picture,
    claims?.sub,
    matchingCurrentUserProfile?.id,
    matchingCurrentUserProfile?.roles,
    isAuthenticated,
    logout,
    canPerformWrites,
    profileName,
    profilePicture,
    queryClient,
    selectedProfileImage,
    setCurrentUserProfile,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !accessToken ||
      isProfileSaving ||
      !claimsNameHasAt ||
      Boolean(matchingCurrentUserProfile?.name)
    ) {
      return;
    }

    const saveKey = `${claims?.sub || 'unknown'}::${fallbackProfileName}`;
    if (normalizedInitialSaveKeyRef.current === saveKey) {
      return;
    }

    normalizedInitialSaveKeyRef.current = saveKey;
    void handleSaveProfile({ showValidationAlert: false, showErrorAlert: false });
  }, [
    accessToken,
    claims?.sub,
    claimsNameHasAt,
    matchingCurrentUserProfile?.name,
    fallbackProfileName,
    handleSaveProfile,
    isAuthenticated,
    isProfileSaving,
  ]);

  const hasPendingProfileNameChange = profileName.trim().length > 0 && profileName.trim() !== fallbackProfileName;
  const hasPendingProfileImageChange = !!selectedProfileImage;
  const pendingProfileDraftKey = useMemo(() => {
    if (!hasPendingProfileNameChange && !hasPendingProfileImageChange) {
      return null;
    }

    return `${profileName.trim()}::${selectedProfileImage?.uri || ''}`;
  }, [hasPendingProfileImageChange, hasPendingProfileNameChange, profileName, selectedProfileImage?.uri]);

  useEffect(() => {
    if (!accessToken || !isAuthenticated || isProfileSaving) {
      return;
    }

    if (!pendingProfileDraftKey) {
      lastAutoSaveAttemptRef.current = null;
      return;
    }

    if (lastAutoSaveAttemptRef.current === pendingProfileDraftKey) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoSaveAttemptRef.current = pendingProfileDraftKey;
      void handleSaveProfile({ showValidationAlert: false, showErrorAlert: false });
    }, PROFILE_AUTO_SAVE_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [
    accessToken,
    handleSaveProfile,
    isAuthenticated,
    isProfileSaving,
    pendingProfileDraftKey,
  ]);

  const handleContinueToStamps = useCallback(async () => {
    const saveSuccessful = await handleSaveProfile();
    if (!saveSuccessful) {
      return;
    }

    await completeOnboarding();
    router.replace('/(tabs)');
  }, [completeOnboarding, handleSaveProfile, router]);

  const handleCreateRequest = useCallback(
    async (userId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        requireOnlineForWrite(canPerformWrites);
        setSubmittingUserId(userId);
        await createFriendRequest(accessToken, userId);
        const matchedUser = searchResults.find((result) => result.id === userId);
        setSentRequests((current) => {
          if (current.some((request) => request.key === userId)) {
            return current;
          }

          return [
            ...current,
            {
              key: userId,
              name: matchedUser?.name || userId,
              picture: matchedUser?.picture,
            },
          ];
        });
      } catch (error) {
        if (isNetworkUnavailableError(error)) {
          Alert.alert('Offline', error.message);
          return;
        }

        if (error instanceof Error && error.name === 'UnauthorizedError') {
          await logout();
          return;
        }

        Alert.alert(
          'Anfrage konnte nicht gesendet werden',
          error instanceof Error ? error.message : 'Unknown error'
        );
      } finally {
        setSubmittingUserId(null);
      }
    },
    [accessToken, canPerformWrites, logout, searchResults]
  );
  const searchListItems = useMemo<FriendsListItem[]>(
    () =>
      searchResults.map((result) => {
        const status: 'request' | 'sent' | 'friend' =
          result.isFriend || sentRequestIdSet.has(result.id)
            ? (result.isFriend ? 'friend' : 'sent')
            : 'request';

        return {
          id: result.id,
          name: result.name,
          image: result.picture,
          subtitle: `${result.visitedCount} Stempel • ${result.completionPercent}%`,
          actionLabel:
            status === 'sent' ? 'Gesendet' : status === 'friend' ? 'Verbunden' : 'Anfrage',
          actionMuted: status !== 'request',
          actionDisabled: status !== 'request' || submittingUserId === result.id || !canPerformWrites,
          onActionPress: () => void handleCreateRequest(result.id),
        };
      }),
    [canPerformWrites, handleCreateRequest, searchResults, sentRequestIdSet, submittingUserId]
  );
  const sentRequestItems = useMemo<FriendsListItem[]>(
    () =>
      sentRequests.map((request) => ({
        id: request.key,
        name: request.name,
        image: request.picture,
        subtitle: 'Anfrage gesendet',
      })),
    [sentRequests]
  );

  async function requestLocationPermission() {
    setLocationError(null);
    setLocationPermission('checking');

    try {
      const result = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(result.granted ? 'granted' : result.status === 'denied' ? 'denied' : 'unknown');
    } catch (error) {
      setLocationPermission('unknown');
      setLocationError(
        error instanceof Error ? error.message : 'Standortberechtigung konnte nicht angefragt werden.'
      );
    }
  }

  if (hasCompletedOnboarding && !isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <LinearGradient colors={['#f7f5ef', '#f3efe6', '#f0ebe1']} style={styles.gradient}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>Erste Schritte</Text>

          <View style={styles.heroRow}>
            <Text style={styles.title}>Mach die App zu deinem Wanderbuddy</Text>
            <Image contentFit="contain" source={bearIllustration} style={styles.heroImage} />
          </View>

          <Text style={styles.copy}>
            Wir fragen nur nach dem, was dir wirklich hilft: Standort für die Karte und
            Benachrichtigungen für neue Stempelstellen.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Konto</Text>
            <Text style={styles.cardCopy}>
              {isAuthenticated
                ? 'Du bist angemeldet und kannst jetzt direkt loslegen.'
                : 'Anmelden ist erforderlich, um Stempel zu speichern.'}
            </Text>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {isAuthenticated ? (
              <>
                <View style={styles.welcomeBox}>
                  <Text style={styles.welcomeEyebrow}>Willkommen</Text>
                  <Text style={styles.welcomeName}>{effectiveProfileName}</Text>
                </View>

                <View style={styles.profileEditor}>
                  <Pressable
                    disabled={isProfileSaving || !canPerformWrites}
                    onPress={() => void handlePickProfileImage()}
                    style={({ pressed }) => [styles.profileAvatarButton, pressed && styles.actionButtonPressed]}>
                    {effectiveProfilePicture ? (
                      <Image
                        cachePolicy="disk"
                        contentFit="cover"
                        source={buildAuthenticatedImageSource(effectiveProfilePicture, accessToken)}
                        style={styles.profileAvatarImage}
                      />
                    ) : (
                      <View style={styles.profileAvatarFallback}>
                        <Feather color="#5F6E5F" name="user" size={26} />
                      </View>
                    )}
                  </Pressable>

                  <View style={styles.profileEditorBody}>
                    <Text style={styles.cardCopy}>
                      Passe deinen Namen und dein Profilbild direkt hier an. Aenderungen speichern automatisch.
                    </Text>
                    <TextInput
                      autoCapitalize="words"
                      editable={!isProfileSaving && canPerformWrites}
                      onChangeText={(value) => {
                        setProfileName(value);
                        setProfileSaveError(null);
                      }}
                      placeholder="Dein Name"
                      placeholderTextColor="#8A968A"
                      style={styles.profileInput}
                      value={profileName}
                    />
                    <View style={styles.row}>
                      <ActionButton
                        disabled={isProfileSaving || !canPerformWrites}
                        label="Profilbild waehlen"
                        onPress={() => void handlePickProfileImage()}
                      />
                    </View>
                    {profileSaveError ? <Text style={styles.errorText}>{profileSaveError}</Text> : null}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.row}>
                <ActionButton
                  disabled={!!configError || isLoading}
                  label={isLoading ? 'Wird vorbereitet...' : 'Anmelden'}
                  onPress={login}
                />
                <ActionButton
                  disabled={!!configError || isLoading}
                  label={isLoading ? 'Wird vorbereitet...' : 'Konto erstellen'}
                  onPress={signup}
                  variant="primary"
                />
              </View>
            )}
          </View>

          <View style={[styles.card, styles.inlineCard]}>
            <View
              style={[
                styles.permissionIcon,
                locationPermission === 'granted' && styles.permissionIconGranted,
              ]}
            />
            <View style={styles.permissionBody}>
              <Text style={styles.cardTitle}>Standort erlauben</Text>
              <Text style={styles.cardCopy}>{locationDescription}</Text>
              {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
            </View>
            <ActionButton
              disabled={
                locationPermission === 'checking' || locationPermission === 'granted'
              }
              label={locationButtonLabel}
              onPress={requestLocationPermission}
              style={[
                styles.inlineAction,
                locationPermission === 'granted' && styles.inlineActionGranted,
              ]}
              variant={locationPermission === 'granted' ? 'primary' : 'secondary'}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hast du schon Wanderbuddies?</Text>
            <Text style={styles.cardCopy}>
              Suche direkt nach Freunden und sende schon jetzt Anfragen.
            </Text>
            <ActionButton
              disabled={!isAuthenticated || !accessToken || !canPerformWrites}
              label="Freunde hinzufügen"
              onPress={() => setIsSearchModalVisible(true)}
              style={styles.fullWidthButton}
            />
            {sentRequests.length > 0 ? (
              <View style={styles.sentRequestsBox}>
                <Text style={styles.sentRequestsTitle}>Gesendete Anfragen</Text>
                <FriendsList items={sentRequestItems} />
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View pointerEvents="box-none" style={[styles.bottomDock, { paddingBottom: bottomDockPadding }]}>
          <View style={styles.bottomSection}>
            <ActionButton
              disabled={primaryDisabled}
              label={isProfileSaving ? 'Speichert...' : 'Zu den Stempelstellen'}
              onPress={() => void handleContinueToStamps()}
              style={[styles.bottomButton, primaryDisabled && styles.bottomButtonDisabled]}
              variant="primary"
            />
            <Text style={styles.footerNote}>{footerNote}</Text>
          </View>
        </View>

        <Modal
          animationType="fade"
          transparent
          visible={isSearchModalVisible}
          onRequestClose={closeSearchModal}>
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={closeSearchModal} />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Freunde finden</Text>
                <Pressable
                  accessibilityLabel="Suche schliessen"
                  onPress={closeSearchModal}
                  style={({ pressed }) => [styles.modalCloseButton, pressed && styles.actionButtonPressed]}>
                  <Feather color="#1E2A1E" name="x" size={16} />
                </Pressable>
              </View>

              <View style={styles.searchInputShell}>
                <View style={styles.searchInputIconWrap}>
                  <Feather color="#6B7A6B" name="search" size={14} />
                </View>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setSearchQuery}
                  placeholder="Name oder Nutzername suchen"
                  placeholderTextColor="#6B7A6B"
                  style={styles.searchInput}
                  value={searchQuery}
                />
              </View>

              <View style={styles.searchResultsColumn}>
                {isSearchLoading ? (
                  <View style={styles.searchStatusWrap}>
                    <ActivityIndicator color="#2E6B4B" size="small" />
                  </View>
                ) : null}

                {!isSearchLoading && searchError ? (
                  <Text style={styles.searchStatusText}>{searchError}</Text>
                ) : null}

                {!isSearchLoading && !searchError && searchQuery.trim().length < 2 ? (
                  <Text style={styles.searchStatusText}>
                    Gib mindestens zwei Zeichen ein, um nach Freunden zu suchen.
                  </Text>
                ) : null}

                {!isSearchLoading &&
                !searchError &&
                searchQuery.trim().length >= 2 &&
                searchResults.length === 0 ? (
                  <Text style={styles.searchStatusText}>Keine passenden Nutzer gefunden.</Text>
                ) : null}

                {!isSearchLoading && !searchError && searchResults.length > 0 ? (
                  <FriendsList items={searchListItems} />
                ) : null}
              </View>

              <View style={styles.modalHint}>
                <Text style={styles.modalHintText}>
                  Profile kannst du nach dem Onboarding in der Freunde-Ansicht oeffnen.
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 180,
    minHeight: '100%',
  },
  eyebrow: {
    color: '#61705f',
    fontSize: 12,
    letterSpacing: 2.2,
    lineHeight: 16,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    color: '#11100d',
    fontSize: 26,
    lineHeight: 38,
    fontFamily: 'serif',
    maxWidth: 190,
  },
  heroImage: {
    width: 148,
    height: 152,
    marginRight: -4,
    marginTop: -8,
  },
  copy: {
    color: '#5a6655',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
    maxWidth: 332,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 18,
    gap: 12,
    shadowColor: '#bda981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 5,
    marginBottom: 18,
  },
  inlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardTitle: {
    color: '#263127',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  cardCopy: {
    color: '#778177',
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: '#8a2d1f',
    fontSize: 12,
    lineHeight: 18,
    marginTop: -2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  welcomeBox: {
    backgroundColor: '#edf4ef',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  welcomeEyebrow: {
    color: '#5f7464',
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  welcomeName: {
    color: '#263127',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  profileEditor: {
    gap: 14,
  },
  profileAvatarButton: {
    alignSelf: 'center',
    borderRadius: 34,
  },
  profileAvatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  profileAvatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E9E2D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileEditorBody: {
    gap: 10,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: '#D7D1C5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1E2A1E',
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    backgroundColor: '#FBF9F4',
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  actionButtonPrimary: {
    backgroundColor: '#397b52',
  },
  actionButtonSecondary: {
    backgroundColor: '#e8dfcf',
  },
  actionButtonDisabled: {
    opacity: 0.48,
  },
  actionButtonPressed: {
    opacity: 0.88,
  },
  actionButtonLabel: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  actionButtonLabelPrimary: {
    color: '#f5f3ee',
  },
  actionButtonLabelSecondary: {
    color: '#374337',
  },
  permissionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#dce8df',
  },
  permissionIconGranted: {
    backgroundColor: '#c9decf',
  },
  permissionBody: {
    flex: 1,
    gap: 4,
  },
  inlineAction: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 104,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  inlineActionGranted: {
    backgroundColor: '#397b52',
  },
  fullWidthButton: {
    width: '100%',
  },
  sentRequestsBox: {
    marginTop: 6,
    backgroundColor: '#f8f6f1',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  sentRequestsTitle: {
    color: '#263127',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(46,58,46,0.35)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginHorizontal: 20,
    marginTop: 120,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#1E2A1E',
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 24,
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#F0E9DD',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  searchInputShell: {
    alignItems: 'center',
    backgroundColor: '#F6F2EA',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInputIconWrap: {
    alignItems: 'center',
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  searchInput: {
    color: '#1E2A1E',
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    padding: 0,
  },
  searchResultsColumn: {
    gap: 10,
    minHeight: 120,
  },
  searchStatusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  searchStatusText: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 8,
  },
  modalHint: {
    backgroundColor: '#F8F6F1',
    borderRadius: 14,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  modalHintText: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  bottomSection: {
    backgroundColor: 'rgba(247, 245, 239, 0.92)',
    borderRadius: 28,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 14,
  },
  bottomButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 22,
  },
  bottomButtonDisabled: {
    backgroundColor: '#d7d3cb',
  },
  footerNote: {
    color: '#798275',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
});
