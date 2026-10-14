import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
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
  KeyboardAvoidingView,
  Platform,
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

import { ClearableSearchInput } from '@/components/clearable-search-input';
import { LegalLinks } from '@/components/legal-links';
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
import { appConfig } from '@/lib/config';
import { buildAuthenticatedImageSource } from '@/lib/images';
import { type UploadableImage } from '@/lib/image-upload';
import {
  isNetworkUnavailableError,
  OFFLINE_REFRESH_MESSAGE,
  requireOnlineForWrite,
} from '@/lib/offline-write';
import { fetchStampsOverviewData, queryKeys } from '@/lib/queries';

const bearIllustration = require('@/assets/images/onboarding-bear.png');
const DEFAULT_AVATARS = [
  { id: 'bear', label: 'Bär', source: require('@/assets/images/avatars/bear.png') },
  { id: 'fox', label: 'Fuchs', source: require('@/assets/images/avatars/fox.png') },
  { id: 'lynx', label: 'Luchs', source: require('@/assets/images/avatars/lynx.png') },
] as const;
const STEPS = [
  { label: 'Willkommen', title: 'Dein nächstes Abenteuer wartet.', copy: 'Entdecke den Harz, sammle Stempel und teile deine Wanderungen mit deinen Buddies.' },
  { label: 'Dein Name', title: 'Wie dürfen wir dich nennen?', copy: 'Mit diesem Namen finden dich deine Wanderbuddies in der App.' },
  { label: 'Dein Avatar', title: 'Welcher Buddy bist du?', copy: 'Wähle deinen Begleiter für den Harz. Oder starte ganz ohne Avatar.' },
  { label: 'Standort', title: 'Das nächste Ziel ist ganz nah.', copy: 'Mit deinem Standort siehst du Entfernungen, Stempelstellen und Parkplätze in deiner Nähe.' },
  { label: 'Wanderbuddies', title: 'Zusammen macht’s mehr Spaß.', copy: 'Finde deine Freunde, vergleicht eure Stempel und plant das nächste Abenteuer.' },
] as const;

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
  const [step, setStep] = useState(0);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
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
  const profileSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const matchingCurrentUserProfile =
    claims?.sub && currentUserProfile?.id === claims.sub ? currentUserProfile : null;
  const primaryDisabled = !isAuthenticated || !!configError || isLoading;
  const errorMessage = configError || authError;
  const fallbackProfileName = getInitialProfileName(
    matchingCurrentUserProfile?.name || claims?.name || claims?.nickname || claims?.given_name || ''
  );
  const effectiveProfilePicture = selectedProfileImage?.uri || profilePicture || null;
  const bottomDockPadding = Math.max(insets.bottom, 16);
  const currentStep = STEPS[step];
  const busy = isProfileSaving || isAdvancing;

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

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
    setProfilePicture(matchingCurrentUserProfile ? matchingCurrentUserProfile.picture ?? '' : claims?.picture ?? '');
    setProfileSaveError(null);
  }, [
    claims?.given_name,
    claims?.name,
    claims?.nickname,
    claims?.picture,
    matchingCurrentUserProfile,
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
    setSelectedAvatar(null);
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

      const nextName = profileName.trim();
      if (!nextName) {
        if (showValidationAlert) {
          Alert.alert('Name fehlt', 'Bitte gib einen Namen ein.');
        }
        return false;
      }

      const nextPictureFromState = profilePicture ?? '';
      const originalPicture = matchingCurrentUserProfile ? matchingCurrentUserProfile.picture ?? '' : claims?.picture ?? '';
      const hasPictureChange = nextPictureFromState !== originalPicture;
      const hasNameChange = nextName !== fallbackProfileName;
      const hasNewSelectedImage = !!selectedProfileImage;
      if (!hasNameChange && !hasNewSelectedImage && !hasPictureChange) {
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
          picture: updatedProfile.picture ?? nextPicture,
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
    matchingCurrentUserProfile,
    isAuthenticated,
    logout,
    canPerformWrites,
    profileName,
    profilePicture,
    queryClient,
    selectedProfileImage,
    setCurrentUserProfile,
  ]);

  const handleAdvance = async () => {
    if (busy) return;
    setIsAdvancing(true);
    try {
      if ((step === 1 || step === 2 || step === 4) && !(await handleSaveProfile())) return;
      if (step === STEPS.length - 1) {
        await completeOnboarding();
        router.replace('/(tabs)');
      } else {
        setStep((current) => current + 1);
      }
    } catch (error) {
      Alert.alert('Onboarding konnte nicht abgeschlossen werden', error instanceof Error ? error.message : 'Bitte versuche es erneut.');
    } finally {
      setIsAdvancing(false);
    }
  };

  const selectAvatar = (id: string) => {
    const avatar = DEFAULT_AVATARS.find((item) => item.id === id);
    setSelectedAvatar(id);
    setProfileSaveError(null);
    if (avatar) {
      setSelectedProfileImage({
        uri: Asset.fromModule(avatar.source).uri,
        fileName: `avatar-${id}.png`,
        mimeType: 'image/png',
      });
    } else {
      setSelectedProfileImage(null);
      setProfilePicture('');
    }
  };

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
        <KeyboardAvoidingView style={styles.flow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.navigation}>
            <Pressable accessibilityRole="button" accessibilityLabel="Vorheriger Schritt" disabled={step === 0 || busy}
              onPress={() => setStep((current) => Math.max(0, current - 1))}
              style={[styles.backButton, step === 0 && { opacity: 0 }]}>
              <Feather name="arrow-left" size={20} color="#284C3B" />
            </Pressable>
            <Text style={styles.stepLabel}>{currentStep.label}</Text>
            <Text style={styles.stepCount}>{step + 1} / {STEPS.length}</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}
            accessibilityLabel="Onboarding-Fortschritt" style={styles.progressRow}>
            {STEPS.map((item, index) => <View key={item.label} style={[styles.progressSegment, index <= step && styles.progressActive]} />)}
          </View>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" bounces={false}
            contentContainerStyle={styles.flowContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.scene, step === 2 && styles.compactScene]}>
              {step === 0 ? <Image contentFit="contain" source={bearIllustration} style={styles.welcomeIllustration} /> :
                step === 1 || step === 2 ? <View style={[styles.avatarPreview, step === 2 && styles.compactAvatarPreview]}>
                  {effectiveProfilePicture ? <Image contentFit="cover" source={selectedProfileImage ? { uri: selectedProfileImage.uri } : buildAuthenticatedImageSource(effectiveProfilePicture, accessToken)} style={styles.previewImage} /> :
                    <Feather name="user" size={58} color="#496850" />}
                </View> : <View style={styles.featureScene}>
                  <View style={styles.sceneOrbit} />
                  <View style={styles.sceneBadge}><Feather name={step === 3 ? 'map-pin' : 'users'} size={54} color="#315B43" /></View>
                  <View style={styles.smallBadge}><Feather name={step === 3 ? 'navigation' : 'heart'} size={22} color="#315B43" /></View>
                </View>}
            </View>
            <Text style={styles.flowEyebrow}>{step === 0 ? 'HARZER WANDER BUDDY' : `SCHRITT ${step + 1} · ${step >= 3 ? 'OPTIONAL' : 'DEIN PROFIL'}`}</Text>
            <Text accessibilityRole="header" style={[styles.flowTitle, step === 2 && styles.compactTitle]}>{currentStep.title}</Text>
            <Text style={styles.flowCopy}>{currentStep.copy}</Text>

            {step === 0 ? <>
              <View style={styles.benefitRow}>
                {[['map', 'Ziele entdecken'], ['award', 'Stempel sammeln'], ['users', 'Gemeinsam los']].map(([icon, label]) =>
                  <View key={label} style={styles.benefit}><Feather name={icon as 'map' | 'award' | 'users'} size={22} color="#315B43" /><Text style={styles.benefitText}>{label}</Text></View>)}
              </View>
              <Text style={styles.guidance}>Vier kurze Schritte, dann geht’s los. Name und Avatar kannst du später im Profil ändern.</Text>
              {!isAuthenticated ? <View style={styles.card}>
                <Text style={styles.cardTitle}>Deine Stempel bekommen ein Zuhause.</Text>
                <Text style={styles.cardCopy}>Melde dich an, um deine Wandererfolge zu speichern.</Text>
                <ActionButton disabled={!!configError || isLoading} label={isLoading ? 'Wird vorbereitet…' : 'Anmelden'}
                  onPress={() => appConfig.authMode === 'basic' ? router.push('/login') : void login()} variant="primary" />
                {appConfig.authMode !== 'basic' ? <ActionButton disabled={!!configError || isLoading} label="Konto erstellen" onPress={signup} /> : null}
              </View> : null}
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </> : null}

            {step === 1 ? <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Dein Anzeigename</Text>
              <TextInput accessibilityLabel="Dein Anzeigename" autoCapitalize="words" maxLength={80}
                editable={!busy && canPerformWrites} onChangeText={(value) => { setProfileName(value); setProfileSaveError(null); }}
                onSubmitEditing={() => { if (profileName.trim()) void handleAdvance(); }} returnKeyType="next"
                placeholder="Zum Beispiel Alex" placeholderTextColor="#8A968A" style={styles.nameInput} value={profileName} />
              <Text style={styles.inputHint}>Ein Vorname oder Spitzname reicht. Dein Profilname ist für andere angemeldete Nutzer auffindbar.</Text>
            </View> : null}

            {step === 2 ? <>
              <View style={styles.avatarGrid}>
                {[...DEFAULT_AVATARS, { id: 'none', label: 'Kein Avatar', source: null }].map((avatar) => {
                  const selected = selectedAvatar === avatar.id || (avatar.id === 'none' && !effectiveProfilePicture);
                  return <Pressable key={avatar.id} accessibilityRole="radio" accessibilityLabel={avatar.label}
                    accessibilityState={{ checked: selected, disabled: busy || !canPerformWrites }} disabled={busy || !canPerformWrites}
                    onPress={() => selectAvatar(avatar.id)} style={[styles.avatarOption, selected && styles.avatarOptionSelected]}>
                    {avatar.source ? <Image source={avatar.source} contentFit="cover" style={styles.choiceImage} /> :
                      <View style={styles.noneAvatar}><Feather name="user" size={35} color="#788779" /></View>}
                    <Text style={[styles.avatarLabel, selected && styles.avatarLabelSelected]}>{avatar.label}</Text>
                    {selected ? <View style={styles.selectionCheck}><Feather name="check" size={14} color="white" /></View> : null}
                  </Pressable>;
                })}
              </View>
              <ActionButton disabled={busy || !canPerformWrites} label="Eigenes Foto hochladen" onPress={() => void handlePickProfileImage()} />
              <Text style={styles.guidance}>Dein Avatar ist für andere angemeldete Nutzer auffindbar.</Text>
            </> : null}

            {step === 3 ? <View style={styles.inputCard}>
              <View style={styles.infoRow}><Feather name="compass" size={22} color="#315B43" /><View style={styles.permissionBody}>
                <Text style={styles.cardTitle}>Orientierung unterwegs</Text><Text style={styles.cardCopy}>Entfernungen auf einen Blick – direkt auf deiner Karte.</Text>
              </View></View>
              <ActionButton disabled={locationPermission === 'checking' || locationPermission === 'granted'}
                label={locationPermission === 'granted' ? 'Standort ist aktiviert' : locationPermission === 'checking' ? 'Wird geprüft…' : locationPermission === 'denied' ? 'Standort erneut anfragen' : 'Standort aktivieren'}
                onPress={requestLocationPermission} variant="secondary" />
              {locationPermission === 'denied' ? <Text style={styles.guidance}>Kein Problem, du kannst ohne Standort starten. Wenn die Anfrage nicht mehr erscheint, erlaube den Zugriff in deinen Geräte- oder Browsereinstellungen.</Text> : null}
              {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
              <Text style={styles.inputHint}>Die Freigabe ist freiwillig und lässt sich in deinen Geräte- oder Browsereinstellungen ändern.</Text>
            </View> : null}

            {step === 4 ? <View style={styles.inputCard}>
              <ActionButton disabled={!accessToken || !canPerformWrites || busy} label="Wanderbuddies finden" onPress={() => setIsSearchModalVisible(true)} variant="secondary" />
              {sentRequests.length > 0 ? <View style={styles.sentRequestsBox}><Text style={styles.sentRequestsTitle}>Deine Anfragen sind unterwegs</Text><FriendsList items={sentRequestItems} /></View> :
                <Text style={styles.guidance}>Auch allein beginnt ein gutes Abenteuer. Freunde kannst du jederzeit später hinzufügen.</Text>}
            </View> : null}
            {profileSaveError && step > 0 ? <Text accessibilityRole="alert" style={styles.errorText}>{profileSaveError}</Text> : null}
            <LegalLinks />
          </ScrollView>
          <View style={[styles.flowDock, { paddingBottom: bottomDockPadding }]}>
            <ActionButton disabled={primaryDisabled || busy || (step === 1 && !profileName.trim()) || locationPermission === 'checking'}
              label={busy ? 'Wird gespeichert…' : step === 0 ? 'Los geht’s' : step === 4 ? 'Zu den Stempelstellen' : step === 3 && locationPermission !== 'granted' ? 'Ohne Standort weiter' : 'Weiter'}
              onPress={() => void handleAdvance()} variant="primary" style={styles.bottomButton} />
            <Text style={styles.footerNote}>{step === 4 ? 'Bereit für deinen ersten Stempel?' : step === 3 ? 'Du entscheidest, was du freigibst.' : 'Dein Abenteuer. Dein Tempo.'}</Text>
          </View>
        </KeyboardAvoidingView>

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
                <ClearableSearchInput
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
  flow: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#E7EBDD' },
  stepLabel: { color: '#315B43', fontWeight: '600', fontSize: 14 },
  stepCount: { color: '#64725E', fontSize: 13, width: 44, textAlign: 'right' },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 28, marginTop: 18 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#DCE1D4' },
  progressActive: { backgroundColor: '#41664A' },
  flowContent: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24, gap: 16 },
  scene: { height: 170, alignItems: 'center', justifyContent: 'center' },
  compactScene: { height: 86 },
  compactAvatarPreview: { width: 80, height: 80, borderRadius: 40, borderWidth: 4 },
  compactTitle: { fontSize: 28, lineHeight: 34 },
  welcomeIllustration: { width: 200, height: 180 },
  avatarPreview: { width: 142, height: 142, borderRadius: 71, backgroundColor: '#E4E9D9', alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: '#FFFFFF' },
  previewImage: { width: '100%', height: '100%', borderRadius: 71 },
  featureScene: { width: 220, height: 160, alignItems: 'center', justifyContent: 'center' },
  sceneOrbit: { position: 'absolute', width: 208, height: 136, borderRadius: 70, borderWidth: 1, borderColor: '#C8D3BC', transform: [{ rotate: '-20deg' }] },
  sceneBadge: { width: 126, height: 126, borderRadius: 63, backgroundColor: '#DFE7D4', alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: '#F9FAF4' },
  smallBadge: { position: 'absolute', right: 16, bottom: 12, width: 52, height: 52, borderRadius: 26, backgroundColor: '#F6DFC4', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#F7F5EF' },
  flowEyebrow: { color: '#68775D', fontSize: 11, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
  flowTitle: { fontFamily: Fonts.serif, color: '#21382B', fontSize: 32, lineHeight: 39, textAlign: 'center' },
  flowCopy: { color: '#65715E', fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 6 },
  benefitRow: { flexDirection: 'row', gap: 8 },
  benefit: { flex: 1, paddingVertical: 16, paddingHorizontal: 6, borderRadius: 20, backgroundColor: '#FFFFFF99', alignItems: 'center', gap: 10 },
  benefitText: { fontSize: 11, color: '#39523E', textAlign: 'center', fontWeight: '600' },
  guidance: { color: '#697361', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  inputCard: { padding: 20, backgroundColor: '#FFFFFFCC', borderRadius: 24, gap: 16 },
  inputLabel: { color: '#36503C', fontSize: 13, fontWeight: '600' },
  nameInput: { color: '#21382B', backgroundColor: '#F4F6ED', borderWidth: 1, borderColor: '#CBD6BF', borderRadius: 16, padding: 16, fontSize: 20, minHeight: 58 },
  inputHint: { color: '#6C7666', fontSize: 12, lineHeight: 18 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  avatarOption: { width: '47%', borderWidth: 2, borderColor: '#E1E4D8', borderRadius: 24, padding: 12, alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF99' },
  avatarOptionSelected: { borderColor: '#41664A', backgroundColor: '#E7EDDE' },
  choiceImage: { width: 82, height: 82, borderRadius: 41 },
  noneAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#EBEEE5', alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { color: '#64725E', fontSize: 14 },
  avatarLabelSelected: { color: '#315B43', fontWeight: '700' },
  selectionCheck: { position: 'absolute', top: 10, right: 10, backgroundColor: '#41664A', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  flowDock: { paddingHorizontal: 28, paddingTop: 12, gap: 10, backgroundColor: '#F3EFE6' },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
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
  permissionBody: {
    flex: 1,
    gap: 4,
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
  bottomButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 22,
  },
  footerNote: {
    color: '#798275',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
});
