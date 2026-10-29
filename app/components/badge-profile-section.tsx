import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { BadgeArtwork } from '@/components/badge-artwork';
import { badgeStyles as s } from '@/components/badge-ui';
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
      {!album ? (
        <Text style={s.text}>
          {error
            ? 'Abzeichen konnten nicht geladen werden.'
            : 'Abzeichen werden geladen …'}
        </Text>
      ) : (
        <>
          {album.selectionChanged && own ? (
            <Text style={[s.text, s.notice]}>
              Besuche geändert: Nicht mehr freigeschaltete Abzeichen, Titel und
              Rahmen wurden aus deiner Auswahl entfernt.
            </Text>
          ) : null}
          {error ? (
            <Text style={s.text}>
              Aktualisierung fehlgeschlagen. Gespeicherter Stand.
            </Text>
          ) : null}
          <View style={[s.row, { justifyContent: 'space-around' }]}>
            {Array.from(
              { length: own ? 3 : album.selection.featured.length },
              (_, index) => {
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
                      {entry ? (
                        <BadgeArtwork entry={entry} size={size} />
                      ) : (
                        <Feather name="plus" size={28} color="#7b8972" />
                      )}
                      {entry && own ? (
                        <View
                          style={{
                            position: 'absolute',
                            right: 0,
                            bottom: 0,
                            backgroundColor: '#fff',
                            borderRadius: 12,
                            padding: 4,
                          }}
                        >
                          <Feather name="edit-2" size={12} color="#596252" />
                        </View>
                      ) : null}
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
                return own ? (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={
                      entry
                        ? `${entry.name} bearbeiten`
                        : `Profilabzeichen ${index + 1} hinzufügen`
                    }
                    onPress={() =>
                      router.push(
                        `/profile/badges/customize?slot=${index}` as never
                      )
                    }
                    style={{
                      flex: 1,
                      minWidth: 0,
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {content}
                  </Pressable>
                ) : (
                  <View
                    key={id}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {content}
                  </View>
                );
              }
            )}
          </View>
          {!album.selection.featured.length ? (
            <Text style={s.text}>
              {own
                ? album.entries.some((e) => e.unlocked)
                  ? 'Wähle die Abzeichen, die du hier zeigen möchtest.'
                  : 'Dein erster Erfolg wartet. Sammle 8 unterschiedliche Stempel für Bronze.'
                : 'Dieses Profil hebt noch keine Abzeichen hervor.'}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
