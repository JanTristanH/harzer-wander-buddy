import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthGuard } from '@/components/auth-guard';
import { SkeletonBlock, SkeletonCircle } from '@/components/skeleton';
import { Fonts } from '@/constants/theme';
import {
  updateCurrentUserProfile,
  uploadProfileImage,
  type CurrentUserProfileData,
  type ProfileOverviewData,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';
import { type UploadableImage } from '@/lib/image-upload';
import { isNetworkUnavailableError, requireOnlineForWrite } from '@/lib/offline-write';
import { queryKeys } from '@/lib/queries';

type SelectedImage = UploadableImage;

type ProfileClaims = {
  sub?: string;
  name?: string;
  picture?: string;
};

function ProfileEditContent() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { accessToken, canPerformWrites, logout, preloadCurrentUserProfile, setCurrentUserProfile } = useAuth();
  const claims = useIdTokenClaims<ProfileClaims>();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<CurrentUserProfileData | null>(null);
  const [name, setName] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowLeavingRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);

    try {
      const nextProfile = await preloadCurrentUserProfile();
      if (!nextProfile) {
        setError('Keine Profildaten verfuegbar.');
        return;
      }

      const resolvedProfile = {
        ...nextProfile,
        name: nextProfile.name || claims?.sub || nextProfile.id,
        picture: nextProfile.picture,
      };
      setProfile(resolvedProfile);
      setName(resolvedProfile.name);
      setSelectedImage(null);
      setError(null);
    } catch (nextError) {
      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        await logout();
        return;
      }

      setError(nextError instanceof Error ? nextError.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [
    accessToken,
    claims?.sub,
    logout,
    preloadCurrentUserProfile,
  ]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const previewImage = selectedImage?.uri || profile?.picture || claims?.picture;
  const trimmedName = name.trim();
  const hasChanges =
    !!profile &&
    (trimmedName !== (profile.name || '').trim() || Boolean(selectedImage));

  const helperText = useMemo(() => {
    if (selectedImage) {
      return 'Neues Profilbild ausgewaehlt. Es wird beim Speichern hochgeladen.';
    }

    return 'Du kannst deinen Anzeigenamen aendern und ein neues Profilbild aus deiner Mediathek hochladen.';
  }, [selectedImage]);

  const closeScreen = useCallback(() => {
    allowLeavingRef.current = true;
    router.back();
  }, [router]);

  const handlePickImage = useCallback(async () => {
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
    setSelectedImage({
      uri: asset.uri,
      fileName: asset.fileName || `profile-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    });
  }, [canPerformWrites]);

  const handleSave = useCallback(async () => {
    if (!accessToken || !profile) {
      return;
    }

    const nextName = trimmedName;
    if (!nextName) {
      Alert.alert('Name fehlt', 'Bitte gib einen Namen ein.');
      return;
    }

    if (!hasChanges) {
      closeScreen();
      return;
    }

    setIsSaving(true);

    try {
      requireOnlineForWrite(canPerformWrites, 'Profil kann nur online gespeichert werden.');

      let nextPicture = profile.picture;

      if (selectedImage) {
        const uploadedImage = await uploadProfileImage(accessToken, selectedImage);
        nextPicture = uploadedImage.url;
      }

      const updatedProfile = await updateCurrentUserProfile(accessToken, {
        name: nextName,
        picture: nextPicture,
      });

      const resolvedProfile = {
        id: profile.id,
        name: updatedProfile.name || nextName,
        picture: updatedProfile.picture || nextPicture,
        roles: profile.roles,
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

      closeScreen();
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        await logout();
        return;
      }

      Alert.alert(
        'Profil konnte nicht gespeichert werden',
        nextError instanceof Error ? nextError.message : 'Unknown error'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    accessToken,
    claims?.sub,
    closeScreen,
    hasChanges,
    logout,
    profile,
    queryClient,
    selectedImage,
    setCurrentUserProfile,
    trimmedName,
    canPerformWrites,
  ]);

  const showLeaveDialog = useCallback((onDiscard: () => void, onSave: () => void) => {
    Alert.alert(
      'Aenderungen speichern?',
      'Du hast ungespeicherte Aenderungen. Moechtest du speichern oder verwerfen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Verwerfen', style: 'destructive', onPress: onDiscard },
        { text: 'Speichern', onPress: onSave },
      ]
    );
  }, []);

  const handleAttemptLeave = useCallback(() => {
    if (isSaving) {
      return;
    }

    if (!hasChanges) {
      closeScreen();
      return;
    }

    showLeaveDialog(
      () => {
        closeScreen();
      },
      () => {
        void handleSave();
      }
    );
  }, [closeScreen, hasChanges, handleSave, isSaving, showLeaveDialog]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeavingRef.current) {
        return;
      }

      if (isSaving) {
        event.preventDefault();
        return;
      }

      if (!hasChanges) {
        return;
      }

      event.preventDefault();
      showLeaveDialog(
        () => {
          allowLeavingRef.current = true;
          navigation.dispatch(event.data.action);
        },
        () => {
          void handleSave();
        }
      );
    });

    return unsubscribe;
  }, [handleSave, hasChanges, isSaving, navigation, showLeaveDialog]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.backButton}>
            <Feather color="#1e2a1e" name="arrow-left" size={18} />
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>Profil bearbeiten</Text>
            <Text style={styles.copy}>Lade Profildaten und bereite Bearbeitung vor.</Text>

            <View style={styles.loadingAvatarSection}>
              <SkeletonCircle size={108} tone="muted" />
              <View style={[styles.secondaryButton, styles.primaryButtonDisabled]}>
                <Text style={styles.secondaryButtonLabel}>Profilbild auswaehlen</Text>
              </View>
            </View>

            <View style={styles.formBlock}>
              <Text style={styles.label}>Name</Text>
              <SkeletonBlock height={50} radius={14} width="100%" />
            </View>

            <View style={[styles.primaryButton, styles.primaryButtonDisabled]}>
              <Text style={styles.primaryButtonLabel}>Speichern</Text>
            </View>
            <Text style={styles.helperText}>Profil wird geladen...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Feather color="#1e2a1e" name="arrow-left" size={18} />
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.title}>Profil bearbeiten</Text>
            <Text style={styles.copy}>{error || 'Keine Profildaten verfuegbar.'}</Text>
            <Pressable
              onPress={() => void loadProfile()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonLabel}>Erneut laden</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
        style={styles.keyboardAvoidingView}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Pressable
            disabled={isSaving}
            onPress={handleAttemptLeave}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Feather color="#1e2a1e" name="arrow-left" size={18} />
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.title}>Profil bearbeiten</Text>
            <Text style={styles.copy}>{helperText}</Text>

            <View style={styles.avatarSection}>
              {previewImage ? (
                <Image
                  cachePolicy="disk"
                  contentFit="cover"
                  source={buildAuthenticatedImageSource(previewImage, accessToken)}
                  style={styles.avatarPreview}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Feather color="#5F6E5F" name="user" size={28} />
                </View>
              )}

                  <Pressable
                    disabled={isSaving || !canPerformWrites}
                    onPress={() => void handlePickImage()}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonLabel}>Profilbild auswaehlen</Text>
              </Pressable>
            </View>

            <View style={styles.formBlock}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                autoCapitalize="words"
                autoComplete="off"
                autoCorrect={false}
                editable={!isSaving && canPerformWrites}
                onChangeText={setName}
                placeholder="Dein Name"
                placeholderTextColor="#8A968A"
                style={styles.input}
                textContentType="none"
                value={name}
              />
            </View>

            <Pressable
              disabled={isSaving || !hasChanges || !canPerformWrites}
              onPress={() => void handleSave()}
              style={({ pressed }) => [
                styles.primaryButton,
                (isSaving || !hasChanges || !canPerformWrites) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}>
              {isSaving ? (
                <ActivityIndicator color="#F5F3EE" size="small" />
              ) : (
                <Text style={styles.primaryButtonLabel}>Speichern</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function ProfileEditScreen() {
  return (
    <AuthGuard>
      <ProfileEditContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F3EE',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 18,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#F0E9DD',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: {
    opacity: 0.84,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  title: {
    color: '#1E2A1E',
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
  },
  copy: {
    color: '#5F6E5F',
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 22,
  },
  helperText: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 12,
  },
  loadingAvatarSection: {
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  avatarPreview: {
    borderRadius: 54,
    height: 108,
    width: 108,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#E8E2D7',
    borderRadius: 54,
    height: 108,
    justifyContent: 'center',
    width: 108,
  },
  formBlock: {
    gap: 8,
  },
  label: {
    color: '#1E2A1E',
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#F8F6F1',
    borderColor: '#E3DDCF',
    borderRadius: 14,
    borderWidth: 1,
    color: '#1E2A1E',
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2E6B4B',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonLabel: {
    color: '#F5F3EE',
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#F0E9DD',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: '#2E3A2E',
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});
