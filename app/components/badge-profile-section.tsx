import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
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
  return (
    <View style={s.card}>
      <Text style={s.heading}>Meine Abzeichen</Text>
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
            {album.selection.featured.map((id) => {
              const entry = album.entries.find((e) => e.id === id);
              return entry ? (
                <View
                  key={id}
                  style={{ alignItems: 'center', maxWidth: 100, gap: 5 }}
                >
                  <BadgeArtwork entry={entry} size={88} />
                  <Text style={[s.text, { fontSize: 13, textAlign: 'center' }]}>
                    {entry.name}
                  </Text>
                </View>
              ) : null;
            })}
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
      {own ? (
        <>
          <BadgeButton onPress={() => router.push('/profile/badges/customize')}>
            Abzeichen, Titel & Rahmen auswählen
          </BadgeButton>
          <BadgeButton secondary onPress={() => router.push('/profile/badges')}>
            Alle Abzeichen
          </BadgeButton>
        </>
      ) : null}
    </View>
  );
}
