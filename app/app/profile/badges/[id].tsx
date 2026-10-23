import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
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

function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refetch } = useBadgeAlbum();
  const router = useRouter();
  const entry = data?.entries.find((e) => e.id === id);
  const missing = entry?.required.filter((stamp) => !stamp.visited) ?? [];
  return (
    <BadgePage title="Abzeichendetails">
      {!data ? (
        <BadgeLoadState error={error} retry={() => void refetch()} />
      ) : !entry ? (
        <Text style={s.text}>Dieses Abzeichen ist nicht verfügbar.</Text>
      ) : (
        <>
          {error ? (
            <Text style={[s.text, s.notice]}>
              Aktualisierung fehlgeschlagen. Gespeicherter Stand.
            </Text>
          ) : null}
          <View style={s.center}>
            <BadgeArtwork entry={entry} locked={!entry.unlocked} size={230} />
            <Text style={[s.title, { textAlign: 'center' }]}>{entry.name}</Text>
            <Text style={[s.text, s.status, !entry.unlocked && s.mutedStatus]}>
              {entry.unlocked
                ? '✓ Freigeschaltet'
                : '🔒 Noch nicht freigeschaltet'}
            </Text>
            {entry.unlocked ? (
              <Text style={s.text}>
                {entry.acquiredAt
                  ? `Erreicht am ${new Date(entry.acquiredAt).toLocaleDateString('de-DE')}`
                  : 'Erreicht · Erwerbsdatum nicht vollständig dokumentiert'}
              </Text>
            ) : null}
          </View>
          <View style={s.card}>
            <Text style={s.heading}>Voraussetzung</Text>
            <Text style={s.text}>{entry.condition}</Text>
            <BadgeProgress entry={entry} />
          </View>
          {entry.note ? (
            <View style={[s.card, { backgroundColor: '#eaf0e7' }]}>
              <Text style={s.heading}>Digital für alle</Text>
              <Text style={s.text}>{entry.note}</Text>
            </View>
          ) : null}
          {entry.required.length ? (
            <View style={s.card}>
              <Text style={s.heading}>
                {entry.unlocked
                  ? 'Pflichtstellen'
                  : 'Pflichtstellen & Fortschritt'}
              </Text>
              {entry.id === 'witch' ? (
                <Text style={s.text}>
                  69 und 140 sind Pflicht. Aus den anderen Stellen zählen neun
                  beliebige.
                </Text>
              ) : null}
              {entry.required.map((stamp) => (
                <Pressable
                  key={stamp.number}
                  disabled={!stamp.id}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !stamp.id }}
                  accessibilityLabel={`${stamp.name}, ${stamp.visited ? 'besucht' : 'offen'}${stamp.id ? ', Details und Karte öffnen' : ', noch nicht im Stempelkatalog verfügbar'}`}
                  onPress={() =>
                    stamp.id && router.push(`/stamps/${stamp.id}` as never)
                  }
                  style={[
                    s.divider,
                    { flexDirection: 'row', alignItems: 'center', gap: 10 },
                  ]}
                >
                  <Feather
                    name={stamp.visited ? 'check-circle' : 'circle'}
                    color="#2e6b4b"
                    size={20}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.text}>
                      {/^\d+$/.test(stamp.number) ? `${stamp.number} · ` : ''}
                      {stamp.name}
                      {entry.id === 'witch' && stamp.mandatory
                        ? ' · Pflicht'
                        : ''}
                    </Text>
                    {!stamp.id ? (
                      <Text style={s.text}>
                        Noch nicht im Stempelkatalog verfügbar
                      </Text>
                    ) : null}
                  </View>
                  {stamp.id ? (
                    <Feather name="chevron-right" color="#2e6b4b" size={18} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {entry.unlocked ? (
            <View style={s.card}>
              <Text style={s.heading}>Für dein Profil</Text>
              {entry.titles.length ? (
                <Text style={s.text}>
                  Titel: {entry.titles.map((t) => t.label).join(' / ')}
                </Text>
              ) : (
                <Text style={s.text}>
                  Dieses Abzeichen verleiht einen Rahmen, keinen Personentitel.
                </Text>
              )}
              <BadgeButton
                onPress={() =>
                  router.push({
                    pathname: '/profile/badges/customize',
                    params: { badge: entry.id },
                  })
                }
              >
                Abzeichen im Profil anzeigen
              </BadgeButton>
              {entry.titles.length ? (
                <BadgeButton
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: '/profile/badges/customize',
                      params: { section: 'title' },
                    })
                  }
                >
                  Titel auswählen
                </BadgeButton>
              ) : null}
              <BadgeButton
                secondary
                onPress={() =>
                  router.push({
                    pathname: '/profile/badges/customize',
                    params: { section: 'frame' },
                  })
                }
              >
                Rahmen auswählen
              </BadgeButton>
            </View>
          ) : (
            <>
              <BadgeButton
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)',
                    params: { badgeGoal: entry.id },
                  })
                }
              >
                Fehlende Stempel entdecken
              </BadgeButton>
              {missing.some((stamp) => !stamp.id) ? (
                <Text style={[s.text, s.notice]}>
                  Fehlende Sonderstempel müssen im Stempelkatalog vorhanden
                  sein, bevor du ihren Besuch erfassen kannst.
                </Text>
              ) : null}
              <Text style={s.text}>
                Rahmen{entry.titles.length ? ' und Titel' : ''} werden mit
                diesem Abzeichen freigeschaltet.
              </Text>
            </>
          )}
          <Text style={[s.text, { textAlign: 'center' }]}>
            Digitaler Erfolg auf Basis deiner Besuche.
          </Text>
        </>
      )}
    </BadgePage>
  );
}
export default function BadgeDetailScreen() {
  return (
    <AuthGuard>
      <Detail />
    </AuthGuard>
  );
}
