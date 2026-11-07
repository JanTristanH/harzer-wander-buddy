import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { BadgeArtwork } from '@/components/badge-artwork';
import { BadgeButton, badgeStyles as s } from '@/components/badge-ui';
import type { BadgeAlbum } from '@/lib/badge-types';

export function BadgeProfileSection({
  album,
  own,
  error,
}: {
  album?: BadgeAlbum;
  own: boolean;
  error?: unknown;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const size = Math.min(96, Math.floor((width - 96) / 3) - 6);
  return (
    <View style={s.card}>
      <Text style={s.heading}>{own ? 'Meine Abzeichen' : 'Abzeichen'}</Text>
      {own ? (
        <BadgeButton onPress={() => router.push('/profile/badges')}>
          Alle Abzeichen entdecken
        </BadgeButton>
      ) : null}
      {!album ? (
        <Text style={s.text}>
          {error ? 'Abzeichen konnten nicht geladen werden.' : 'Abzeichen werden geladen …'}
        </Text>
      ) : (
        <>
          {album.selectionChanged && own ? (
            <Text style={[s.text, s.notice]}>
              Besuche geändert: Nicht mehr freigeschaltete Abzeichen, Titel und Rahmen wurden aus
              deiner Auswahl entfernt.
            </Text>
          ) : null}
          {error ? (
            <Text style={s.text}>Aktualisierung fehlgeschlagen. Gespeicherter Stand.</Text>
          ) : null}
          <View style={[s.row, { justifyContent: 'space-around' }]}>
            {Array.from({ length: album.selection.featured.length }, (_, index) => {
              const id = album.selection.featured[index];
              const entry = album.entries.find((e) => e.id === id);
              const content = (
                <>
                  <View
                    style={{
                      position: 'relative',
                      borderWidth: 1,
                      borderStyle: entry ? 'solid' : 'dashed',
                      borderColor: '#b7c3ac',
                      borderRadius: 100,
                      padding: 4,
                      width: size + 8,
                      height: size + 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {entry ? <BadgeArtwork entry={entry} size={size} /> : null}
                  </View>
                  <Text
                    style={[
                      s.text,
                      {
                        fontSize: entry ? 13 : 11,
                        fontWeight: entry ? '600' : '400',
                        color: entry ? '#20291f' : '#647064',
                        textAlign: 'center',
                      },
                    ]}
                  >
                    {entry?.name || 'Abzeichen hinzufügen'}
                  </Text>
                </>
              );
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry?.name || 'Abzeichen'} ansehen`}
                  onPress={() => router.push(`/profile/badges/${encodeURIComponent(id)}` as never)}
                  style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}
                >
                  {content}
                </Pressable>
              );
            })}
          </View>
          {!album.selection.featured.length ? (
            <Text style={s.text}>
              {own
                ? album.entries.some((e) => e.unlocked)
                  ? 'Du hast noch keine Abzeichen für dein Profil ausgewählt.'
                  : 'Dein erster Erfolg wartet. Sammle 8 unterschiedliche Stempel für Bronze.'
                : 'Dieses Profil hebt noch keine Abzeichen hervor.'}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
