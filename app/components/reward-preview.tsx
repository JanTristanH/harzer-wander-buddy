import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { BadgeArtwork } from './badge-artwork';
import { BadgeTitle } from './badge-title';
import { badgeStyles as s } from './badge-ui';
import type { BadgeEntry } from '@/lib/badge-types';
import { useAuth } from '@/lib/auth';
import { physicalReward, officialLinks } from '@/lib/badge-rewards';
export function RewardPreview({ entry }: { entry: BadgeEntry }) {
  const { currentUserProfile } = useAuth();
  const state = {
    name: currentUserProfile?.name || 'Dein Profil',
    picture: currentUserProfile?.picture,
  };
  const info = physicalReward(entry),
    title = entry.titles[0]?.label;
  return (
    <View style={s.card}>
      <Text style={s.heading}>Deine Belohnung</Text>
      <Text style={s.text}>
        Ein eigener Avatarrahmen
        {entry.titles.length ? ' und ein zusätzlicher Profiltitel.' : '.'}
      </Text>
      <View
        accessibilityLabel={`Beispielprofil mit ${entry.name}`}
        style={r.preview}
      >
        <Text style={r.kicker}>BEISPIEL FÜR DEIN PROFIL</Text>
        <BadgeArtwork
          image={state.picture}
          frame={entry.frame}
          initials={state.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((x: string) => x[0] || '')
            .join('')
            .toUpperCase()}
          size={126}
        />
        <Text style={r.name}>{state.name}</Text>
        {title ? (
          <View>
            <BadgeTitle title={title} />
          </View>
        ) : (
          <Text style={r.small}>
            Dieses Abzeichen schaltet keinen zusätzlichen Titel frei.
          </Text>
        )}
        <BadgeArtwork entry={entry} size={76} />
        <Text style={r.small}>
          {entry.unlocked
            ? 'So sieht dein Profil mit dieser Belohnung aus.'
            : 'So könnte dein Profil nach der Freischaltung aussehen.'}
        </Text>
      </View>
      <View accessibilityLabel="Physisches Abzeichen" style={r.physical}>
        <Text style={[r.kicker, { color: '#786442' }]}>AUCH ZUM ANSTECKEN</Text>
        <Text style={[s.heading, { fontSize: 21 }]}>{info.heading}</Text>
        <Text style={r.body}>{info.description}</Text>
        {info.booklet ? <Text style={r.body}>{info.booklet}</Text> : null}
        {info.special ? (
          <Text
            style={[
              r.body,
              { borderLeftWidth: 3, borderColor: '#b19b6e', paddingLeft: 12 },
            ]}
          >
            {info.special}
          </Text>
        ) : null}
        <Text style={r.small}>{info.availability}</Text>
        <Link href={officialLinks.outlets} target="_blank" style={r.linkButton}>
          Vertriebsstellen finden ↗
        </Link>
        <Link href={info.source} target="_blank" style={r.link}>
          Offizielle Voraussetzungen ↗
        </Link>
        <Text style={r.small}>{info.proof}</Text>
      </View>
    </View>
  );
}
const r = StyleSheet.create({
  preview: {
    padding: 22,
    borderWidth: 1,
    borderColor: '#dce2d7',
    borderRadius: 18,
    backgroundColor: '#f8f9f4',
    alignItems: 'center',
    gap: 14,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: '700',
    color: '#647064',
  },
  name: {
    fontSize: 25,
    fontFamily: 'serif',
    fontWeight: '700',
    textAlign: 'center',
    color: '#20291f',
  },
  small: {
    fontSize: 12,
    lineHeight: 19,
    color: '#647064',
    textAlign: 'center',
  },
  physical: {
    padding: 20,
    borderWidth: 1,
    borderColor: '#dfd6be',
    borderRadius: 18,
    backgroundColor: '#eee9db',
    gap: 12,
  },
  body: { fontSize: 13, lineHeight: 21, color: '#615d4c' },
  linkButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c3cfc3',
    borderRadius: 24,
    padding: 14,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#2e6b4b',
  },
  link: {
    fontSize: 12,
    color: '#2e6b4b',
    fontWeight: '600',
    paddingVertical: 8,
    textAlign: 'center',
  },
});
