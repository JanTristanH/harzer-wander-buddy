import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BadgeArtwork } from './badge-artwork';
import { BadgeTitle } from './badge-title';
import { badgeTitle, type BadgeAlbum } from '@/lib/badge-types';
export function BadgeProfilePreview({
  album,
  name,
  count,
  picture,
  editable = false,
  offline = false,
  onName,
  onSlot,
  onAvatar,
}: {
  album: BadgeAlbum;
  name: string;
  count: number;
  picture?: string;
  editable?: boolean;
  offline?: boolean;
  onName?: (name: string) => void;
  onSlot?: (slot: number) => void;
  onAvatar?: () => void;
}) {
  const { width } = useWindowDimensions();
  const artSize = Math.min(96, Math.floor((width - 100) / 3) - 8);
  return (
    <View style={s.card}>
      <Pressable
        disabled={!editable || offline}
        onPress={onAvatar}
        accessibilityRole="button"
        accessibilityLabel="Name und Profilbild bearbeiten"
        style={{ position: 'relative' }}
      >
        <BadgeArtwork
          image={picture}
          frame={
            album.entries.find((e) => e.id === album.selection.frame)?.frame
          }
          initials={name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((x) => x[0] || '')
            .join('')
            .toUpperCase()}
          size={126}
        />
        {editable ? (
          <Text
            style={{
              fontSize: 12,
              color: '#596a4d',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            Profilbild {picture ? 'ändern' : 'wählen'}
          </Text>
        ) : null}
        {editable ? (
          <View style={[s.pencil, { top: 96, bottom: undefined }]}>
            <Feather name="edit-2" size={13} color="#596a4d" />
          </View>
        ) : null}
      </Pressable>
      {editable ? (
        <View style={s.nameRow}>
          <TextInput
            accessibilityLabel="Anzeigename"
            placeholder="Dein Name"
            editable={!offline}
            maxLength={50}
            value={name}
            onChangeText={onName}
            style={s.nameInput}
          />
          <Feather name="edit-2" size={16} color="#788777" />
        </View>
      ) : (
        <Text style={s.name}>{name}</Text>
      )}
      <View style={{ alignItems: 'center' }}>
        <BadgeTitle title={badgeTitle(album)} />
      </View>
      <Text style={s.meta}>
        {count} Stempelstellen ·{' '}
        {album.entries.filter((e) => e.unlocked).length} Abzeichen
      </Text>
      <View style={s.slots}>
        {Array.from({ length: 3 }, (_, i) => {
          const entry = album.entries.find(
            (e) => e.id === album.selection.featured[i]
          );
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={
                entry
                  ? `${entry.name} bearbeiten`
                  : `Profilabzeichen ${i + 1} hinzufügen`
              }
              disabled={offline}
              onPress={() => onSlot?.(i)}
              style={s.slot}
            >
              <View
                style={[
                  s.circle,
                  { width: artSize + 8, height: artSize + 8 },
                  !entry && { borderStyle: 'dashed' },
                ]}
              >
                {entry ? (
                  <BadgeArtwork entry={entry} size={artSize} />
                ) : (
                  <Feather name="plus" size={27} color="#7b8972" />
                )}
                {entry && onSlot ? (
                  <View style={s.pencil}>
                    <Feather name="edit-2" size={11} color="#596a4d" />
                  </View>
                ) : null}
              </View>
              <Text style={[s.slotLabel, entry && s.filledLabel]}>
                {entry?.name || 'Abzeichen hinzufügen'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {editable ? (
        <Text style={s.hint}>
          Name direkt bearbeiten. Tippe auf einen Kreis für deine Abzeichen.
        </Text>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    fontFamily: 'serif',
    fontWeight: '700',
    fontSize: 28,
    color: '#20291f',
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  nameInput: {
    fontFamily: 'serif',
    fontWeight: '700',
    fontSize: 27,
    color: '#20291f',
    textAlign: 'center',
    minWidth: 0,
    flex: 1,
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e6dc',
  },
  meta: { fontSize: 13, color: '#647064', textAlign: 'center' },
  slots: { flexDirection: 'row', width: '100%', gap: 8, marginTop: 10 },
  slot: { flex: 1, minWidth: 0, alignItems: 'center', gap: 10 },
  circle: {
    width: 84,
    height: 84,
    borderWidth: 1,
    borderColor: '#b7c3ac',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pencil: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c8d1bf',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: { fontSize: 11, color: '#647064', textAlign: 'center' },
  filledLabel: { fontSize: 13, fontWeight: '600', color: '#20291f' },
  hint: { fontSize: 12, color: '#788777', textAlign: 'center', lineHeight: 18 },
});
