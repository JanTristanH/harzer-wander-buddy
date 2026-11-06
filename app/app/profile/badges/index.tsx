import {NextBadgeGoal} from '@/components/next-badge-goal';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthGuard } from '@/components/auth-guard';
import { BadgeArtwork } from '@/components/badge-artwork';
import {
  BadgeButton,
  BadgeLoadState,
  BadgePage,
  BadgeProgress,
  badgeStyles as s,
} from '@/components/badge-ui';
import { useBadgeAlbum } from '@/lib/badges';

function Album() {
  const router = useRouter();
  const { data, error, refetch } = useBadgeAlbum();
  const [filter, setFilter] = useState('Alle');
  return (
    <BadgePage title="Abzeichenalbum">
      {!data ? (
        <BadgeLoadState error={error} retry={() => void refetch()} />
      ) : (
        <>
          <Text style={s.text}>
            Deine Wandererfolge ·{' '}
            {data.entries.filter((e) => e.unlocked).length} von{' '}
            {data.entries.length} freigeschaltet
          </Text>
          <NextBadgeGoal album={data}/>
          {error ? (
            <Text style={[s.text, s.notice]}>
              Aktualisierung fehlgeschlagen. Du siehst den zuletzt gespeicherten
              Stand.
            </Text>
          ) : null}
          {data.selectionChanged ? (
            <Text style={[s.text, s.notice]}>
              Deine Besuche wurden geändert. Nicht mehr freigeschaltete
              Abzeichen, Titel und Rahmen wurden aus deiner Auswahl entfernt.
            </Text>
          ) : null}
          {!data.entries.some((e) => e.unlocked) ? (
            <View style={s.card}>
              <Text style={s.heading}>Dein erster Erfolg wartet</Text>
              <Text style={s.text}>
                Sammle 8 unterschiedliche Stempel für deinen Bronzerahmen. Alle
                Ziele kannst du schon jetzt entdecken.
              </Text>
              <BadgeButton secondary onPress={() => router.push('/(tabs)')}>
                Stempel entdecken
              </BadgeButton>
            </View>
          ) : null}
          <View style={s.row}>
            {['Alle', 'Erreicht', 'Offen'].map((label) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === label }}
                onPress={() => setFilter(label)}
                style={[s.chip, filter === label && s.selected]}
              >
                <Text style={[s.text, filter === label && { color: '#20291f' }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {[...new Set(data.entries.map((e) => e.category))].map((category) => {
            const entries = data.entries.filter(
              (e) =>
                e.category === category &&
                (filter === 'Alle' || e.unlocked === (filter === 'Erreicht'))
            );
            return entries.length ? (
              <View key={category} style={{ gap: 14 }}>
                <Text style={s.heading}>{category}</Text>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
                >
                  {entries.map((entry) => (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${entry.name}, ${entry.unlocked ? 'freigeschaltet' : 'offen'}, Details anzeigen`}
                      onPress={() =>
                        router.push(`/profile/badges/${entry.id}` as never)
                      }
                      style={[
                        s.card,
                        {
                          width: '47%',
                          flexGrow: 1,
                          alignItems: 'center',
                          padding: 14,
                        },
                      ]}
                    >
                      <BadgeArtwork
                        entry={entry}
                        locked={!entry.unlocked}
                        size={112}
                      />
                      <Text
                        style={[
                          s.heading,
                          { fontSize: 18, textAlign: 'center' },
                        ]}
                      >
                        {entry.name}
                      </Text>
                      <Text
                        style={[
                          s.status,
                          !entry.unlocked && s.mutedStatus,
                          s.text,
                        ]}
                      >
                        {entry.unlocked ? '✓ Erreicht' : '🔒 Offen'}
                      </Text>
                      <View style={{ alignSelf: 'stretch' }}>
                        <BadgeProgress entry={entry} compact />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null;
          })}
          {!data.entries.some(
            (e) => filter === 'Alle' || e.unlocked === (filter === 'Erreicht')
          ) ? (
            <Text style={s.text}>
              {filter === 'Erreicht'
                ? 'Noch keine Abzeichen erreicht. Dein erster Stempel wartet.'
                : 'Du hast alle Abzeichen freigeschaltet!'}
            </Text>
          ) : null}
          <BadgeButton onPress={() => router.push('/profile/badges/customize')}>
            Profil gestalten
          </BadgeButton>
        </>
      )}
    </BadgePage>
  );
}
export default function BadgeAlbumScreen() {
  return (
    <AuthGuard>
      <Album />
    </AuthGuard>
  );
}
