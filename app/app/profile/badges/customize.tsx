import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AuthGuard } from '@/components/auth-guard';
import { BadgeArtwork } from '@/components/badge-artwork';
import { BadgeProfilePreview } from '@/components/badge-profile-preview';
import { BadgeButton, BadgeLoadState, BadgePage, badgeStyles as s } from '@/components/badge-ui';
import { saveBadgeProfile, updateCurrentUserProfile, uploadProfileImage } from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { useBadgeAlbum } from '@/lib/badges';
import type { UploadableImage } from '@/lib/image-upload';
import { ProfilePhotoEditor } from '@/components/profile-photo-editor';
import { ProfileImageViewer } from '@/components/profile-image-viewer';
import type { BadgeSelection } from '@/lib/badge-types';
import { requireOnlineForWrite } from '@/lib/offline-write';
import { queryKeys, useAuthorizedRequest } from '@/lib/queries';

function Customize() {
  const { data, error, refetch } = useBadgeAlbum();
  const { badge, slot } = useLocalSearchParams<{
    badge?: string;
    slot?: string;
  }>();
  const {
    currentUserProfile,
    preloadCurrentUserProfile,
    setCurrentUserProfile,
    canPerformWrites,
    isOffline,
  } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const router = useRouter();
  const request = useAuthorizedRequest();
  const client = useQueryClient();
  const [selection, setSelection] = useState<BadgeSelection | null>(null);
  const [name, setName] = useState(currentUserProfile?.name || '');
  const sourceName = useRef(currentUserProfile?.name || '');
  const navigation = useNavigation();
  const allowLeave = useRef(false);
  const [photoDraft, setPhotoDraft] = useState<UploadableImage | null>(null);
  const [selectedImage, setSelectedImage] = useState<UploadableImage | null>(null);
  async function pickImage() {
    try {
      requireOnlineForWrite(canPerformWrites);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage('Bitte erlaube den Zugriff auf deine Fotos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: Platform.OS !== 'web',
        aspect: [1, 1],
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      const applyImage = Platform.OS === 'web' ? setPhotoDraft : setSelectedImage;
      applyImage({
        uri: asset.uri,
        fileName: asset.fileName || `profile-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      });
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bild konnte nicht ausgewählt werden.');
    }
  }
  const [frames, setFrames] = useState(false);
  const [picker, setPicker] = useState<number | null>(
    slot !== undefined ? Math.max(0, Math.min(2, Number(slot) || 0)) : null
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!currentUserProfile && preloadCurrentUserProfile) {
      void preloadCurrentUserProfile().catch((error) =>
        setMessage(error instanceof Error ? error.message : 'Profil konnte nicht geladen werden.')
      );
    }
  }, [currentUserProfile, preloadCurrentUserProfile]);
  const disabled = isOffline || !canPerformWrites || saving;
  useEffect(() => {
    const nextName = currentUserProfile?.name || '';
    setName((draft) => (draft === sourceName.current ? nextName : draft));
    sourceName.current = nextName;
  }, [currentUserProfile?.name]);
  useEffect(() => {
    if (!data || selection) return;
    const featured = [...data.selection.featured];
    if (
      badge &&
      data.entries.some((e) => e.id === badge && e.unlocked) &&
      !featured.includes(badge) &&
      featured.length < 3
    )
      featured.push(badge);
    setSelection({ ...data.selection, featured });
  }, [data, selection, badge]);
  const change = (value: Partial<BadgeSelection>) =>
    setSelection((old) => (old ? { ...old, ...value } : old));
  function choose(id: string) {
    if (!selection || picker === null || disabled) return;
    const next = Array.from({ length: 3 }, (_, i) => selection.featured[i] || '');
    const previous = next.indexOf(id);
    if (id && previous >= 0 && previous !== picker) next[previous] = next[picker];
    next[picker] = id;
    change({ featured: next });
    setPicker(null);
  }
  async function save() {
    if (!data || !selection || saving) return;
    if (!name.trim()) {
      setMessage('Bitte gib einen Namen ein.');
      return;
    }
    setSaving(true);
    setMessage('');
    let nameSaved = false;
    try {
      requireOnlineForWrite(canPerformWrites);
      if (selectedImage || name.trim() !== (currentUserProfile?.name || '').trim()) {
        if (!currentUserProfile)
          throw new Error('Profildaten fehlen. Bitte lade das Profil erneut.');
        const picture = selectedImage
          ? (await request((token) => uploadProfileImage(token, selectedImage))).url
          : currentUserProfile.picture;
        const updated = await request((token) =>
          updateCurrentUserProfile(token, { name: name.trim(), picture }, currentUserProfile.id)
        );
        setCurrentUserProfile({
          ...currentUserProfile,
          name: updated.name || name.trim(),
          picture: updated.picture || picture,
        });
        setSelectedImage(null);
        nameSaved = true;
        await client.invalidateQueries({
          queryKey: queryKeys.profileOverview(claims?.sub),
        });
      }
      const featured = [...new Set(selection.featured.filter(Boolean))].slice(0, 3);
      const result = await request((token) => saveBadgeProfile(token, { ...selection, featured }));
      await client.invalidateQueries({ queryKey: ['badgeAlbum'] });
      setSelection(result.selection);
      allowLeave.current = true;
      router.replace('/(tabs)/profile');
    } catch (nextError) {
      const detail =
        nextError instanceof Error
          ? nextError.message
          : 'Die Auswahl konnte nicht gespeichert werden.';
      setMessage(
        (nameSaved
          ? 'Name und Profilbild gespeichert. Die Abzeichenauswahl wurde noch nicht gespeichert: '
          : '') + detail
      );
    } finally {
      setSaving(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  const hasChanges =
    !!selectedImage ||
    name.trim() !== (currentUserProfile?.name || '').trim() ||
    !!(selection && data && JSON.stringify(selection) !== JSON.stringify(data.selection));
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (allowLeave.current || (!hasChanges && !saving)) return;
        event.preventDefault();
        if (saving) return;
        Alert.alert('Änderungen speichern?', 'Du hast ungespeicherte Änderungen.', [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Verwerfen',
            style: 'destructive',
            onPress: () => {
              allowLeave.current = true;
              navigation.dispatch(event.data.action);
            },
          },
          { text: 'Speichern', onPress: () => void saveRef.current() },
        ]);
      }),
    [navigation, hasChanges, saving]
  );
  return (
    <BadgePage
      title="Profil bearbeiten"
      footer={
        data && selection ? (
          <>
            {message ? (
              <Text accessibilityRole="alert" style={[s.text, s.notice]}>
                {message}
              </Text>
            ) : null}
            <BadgeButton disabled={disabled} onPress={() => void save()}>
              {saving ? 'Wird gespeichert …' : 'Änderungen speichern'}
            </BadgeButton>
          </>
        ) : undefined
      }
    >
      <ProfilePhotoEditor image={photoDraft} onCancel={() => setPhotoDraft(null)} onApply={image => { setSelectedImage(image); setPhotoDraft(null); }} />
      {!data || !selection ? (
        <BadgeLoadState error={error} retry={() => void refetch()} />
      ) : (
        <>
          {data.selectionChanged ? (
            <Text style={[s.text, s.notice]}>
              Besuche geändert: Nicht mehr berechtigte Auswahlen wurden entfernt.
            </Text>
          ) : null}
          <BadgeProfilePreview
            album={{ ...data, selection }}
            name={name}
            picture={selectedImage?.uri || currentUserProfile?.picture}
            count={data.entries.find((e) => e.id === 'emperor')?.progress[0]?.current || 0}
            editable
            offline={disabled}
            onName={setName}
            onSlot={setPicker}
            onAvatar={() => void pickImage()}
          />
          <ProfileImageViewer uri={selectedImage?.uri || currentUserProfile?.picture}>
            <Text style={s.text}>Profilbild groß ansehen</Text>
          </ProfileImageViewer>
          <View style={s.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Avatarrahmen Auswahl"
              accessibilityState={{ expanded: frames }}
              onPress={() => setFrames(!frames)}
              style={[s.row, { justifyContent: 'space-between' }]}
            >
              <View>
                <Text style={s.heading}>Avatarrahmen</Text>
                <Text style={s.text}>
                  {data.entries.find((e) => e.id === selection.frame)?.name || 'Kein Rahmen'}
                </Text>
              </View>
              <Feather name={frames ? 'chevron-up' : 'chevron-down'} size={22} color="#596252" />
            </Pressable>
            {frames ? (
              <View style={s.row}>
                {[{ id: '', name: 'Kein Rahmen', frame: '', unlocked: true }, ...data.entries].map(
                  (e) => (
                    <Pressable
                      key={e.id}
                      disabled={disabled || !e.unlocked}
                      accessibilityRole="radio"
                      accessibilityLabel={`Rahmen ${e.name}`}
                      accessibilityState={{
                        checked: selection.frame === e.id,
                        disabled: disabled || !e.unlocked,
                      }}
                      onPress={() => change({ frame: e.id })}
                      style={{
                        width: 90,
                        padding: 7,
                        borderWidth: selection.frame === e.id ? 2 : 1,
                        borderColor: selection.frame === e.id ? '#596252' : '#dce2d7',
                        borderRadius: 14,
                        alignItems: 'center',
                        gap: 6,
                        opacity: e.unlocked ? 1 : 0.4,
                      }}
                    >
                      <BadgeArtwork frame={e.frame} locked={!e.unlocked} size={66} />
                      <Text style={{ fontSize: 11, textAlign: 'center' }}>{e.name}</Text>
                    </Pressable>
                  )
                )}
              </View>
            ) : null}
          </View>
          <View style={s.card}>
            <Text style={s.heading}>Dein Titel</Text>
            <View style={s.row}>
              {[
                { id: '', label: 'Kein Titel' },
                { id: 'wanderer', label: 'Wanderer' },
                ...data.entries.filter((e) => e.unlocked).flatMap((e) => e.titles),
              ].map((title) => (
                <Pressable
                  key={title.id}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selection.title === title.id }}
                  aria-checked={selection.title === title.id}
                  onPress={() => change({ title: title.id })}
                  accessibilityLabel={title.label}
                  style={[s.chip, { borderWidth: 2, borderColor: selection.title === title.id ? '#2e6b4b' : 'transparent' }, selection.title === title.id && { backgroundColor: '#e6eee4' }]}
                >
                  <Text style={[s.text, selection.title === title.id && { color: '#214f36', fontWeight: '700' }]}>{selection.title === title.id ? '✓ ' : ''}{title.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Modal
            visible={picker !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setPicker(null)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: '#15231380',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 14,
              }}
            >
              <ScrollView
                style={{
                  width: '100%',
                  maxWidth: 600,
                  maxHeight: '85%',
                  backgroundColor: '#f5f3ee',
                  borderRadius: 22,
                }}
                contentContainerStyle={{ padding: 22, gap: 16 }}
              >
                <View style={[s.row, { justifyContent: 'space-between' }]}>
                  <Text style={s.heading}>Abzeichen aussuchen</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Auswahl schließen"
                    onPress={() => setPicker(null)}
                    style={{ padding: 10 }}
                  >
                    <Feather name="x" size={22} />
                  </Pressable>
                </View>
                <Text style={s.text}>Platz {(picker || 0) + 1}</Text>
                <View style={s.row}>
                  {data.entries.map((entry) => (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="radio"
                      accessibilityLabel={entry.name}
                      accessibilityState={{
                        checked: picker !== null && selection.featured[picker] === entry.id,
                        disabled: disabled || !entry.unlocked,
                      }}
                      disabled={disabled || !entry.unlocked}
                      onPress={() => choose(entry.id)}
                      style={{
                        width: '46%',
                        flexGrow: 1,
                        alignItems: 'center',
                        padding: 12,
                        gap: 8,
                        backgroundColor: '#fff',
                        borderRadius: 16,
                        borderWidth:
                          picker !== null && selection.featured[picker] === entry.id ? 2 : 1,
                        borderColor: '#596252',
                        opacity: entry.unlocked ? 1 : 0.4,
                      }}
                    >
                      <BadgeArtwork entry={entry} locked={!entry.unlocked} size={88} />
                      <Text style={[s.text, { fontSize: 13, textAlign: 'center' }]}>
                        {entry.name}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: entry.unlocked ? '#214f36' : '#647064', backgroundColor: entry.unlocked ? '#e6eee4' : '#eceae2', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, overflow: 'hidden' }}>
                        {picker !== null && selection.featured[picker] === entry.id
                          ? '✓ Auf diesem Platz'
                          : entry.unlocked
                            ? 'Auswählen'
                            : 'Noch offen'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <BadgeButton secondary disabled={disabled} onPress={() => choose('')}>
                  Diesen Platz leeren
                </BadgeButton>
              </ScrollView>
            </View>
          </Modal>
        </>
      )}
    </BadgePage>
  );
}
export default function CustomizeBadgesScreen() {
  return (
    <AuthGuard>
      <Customize />
    </AuthGuard>
  );
}
