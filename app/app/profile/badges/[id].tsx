import { useQuery } from '@tanstack/react-query';
import { fetchBadgeStampboxes } from '@/lib/api';
import { useIdTokenClaims } from '@/lib/auth';
import { useAuthorizedRequest } from '@/lib/queries';
import { StampListItem } from '@/components/stamp-list-item';
import { RewardPreview } from '@/components/reward-preview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
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
  const claims = useIdTokenClaims<{ sub?: string }>();
  const request = useAuthorizedRequest();
  const ids =
    entry?.required.flatMap((stamp) => (stamp.id ? [stamp.id] : [])) ?? [];
  const locations = useQuery({
    queryKey: ['badge-stamps', claims?.sub, [...ids].sort().join(',')],
    enabled: Boolean(claims?.sub && ids.length),
    queryFn: () => request((token) => fetchBadgeStampboxes(token, ids)),
  });
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
          <RewardPreview entry={entry} />
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
              {locations.error ? (
                <Text style={s.text}>
                  Bilder konnten nicht aktualisiert werden. Die Pflichtstellen
                  bleiben sichtbar.
                </Text>
              ) : null}
              {entry.required.map((stamp, index) => {
                const metadata = locations.data?.find(
                  (item) => item.ID === stamp.id
                );
                return (
                  <StampListItem
                    key={stamp.number}
                    index={index}
                    disabled={!stamp.id}
                    item={{
                      ...metadata,
                      ID: stamp.id || stamp.number,
                      number: stamp.number,
                      name: stamp.name,
                      description:
                        metadata?.description ||
                        (!stamp.id
                          ? 'Noch nicht im Stempelkatalog verfügbar.'
                          : 'Pflichtstelle für dieses Abzeichen.'),
                      hasVisited: stamp.visited,
                    }}
                    metaLabel={
                      entry.id === 'witch'
                        ? stamp.mandatory
                          ? 'Pflicht'
                          : 'Auswahl'
                        : undefined
                    }
                    onPress={() => {
                      if (stamp.id) router.push(`/stamps/${stamp.id}` as never);
                    }}
                  />
                );
              })}
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.heading}>Dein nächstes Wanderziel</Text>
              <Text style={s.text}>
                Für dieses Leistungsabzeichen zählt jede reguläre Stempelstelle.
              </Text>
              <BadgeButton secondary onPress={() => router.push('/(tabs)')}>
                Stempelstellenliste öffnen
              </BadgeButton>
            </View>
          )}
          {entry.unlocked ? (
            <View style={s.card}>
              <Text style={s.heading}>Im Profil verwenden</Text>
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
