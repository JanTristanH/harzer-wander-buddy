import React from 'react';
import { View, Text } from 'react-native';
import { BadgeArtwork } from './badge-artwork';
import { BadgeProgress, badgeStyles as s } from './badge-ui';
import type { BadgeAlbum } from '@/lib/badge-types';
export function NextBadgeGoal({ album }: { album: BadgeAlbum }) {
  const entry = album.entries.find((e) => !e.unlocked);
  return (
    <View
      accessibilityLabel="Dein nächstes Ziel"
      style={[s.card, { backgroundColor: '#e9ebdf', gap: 14 }]}
    >
      <Text
        style={{
          fontSize: 11,
          letterSpacing: 1.2,
          fontWeight: '700',
          color: '#2e6b4b',
        }}
      >
        {entry ? 'DEIN NÄCHSTES ZIEL' : 'ALLE ZIELE ERREICHT'}
      </Text>
      {entry ? (
        <>
          <View style={[s.row, { flexWrap: 'nowrap' }]}>
            <BadgeArtwork entry={entry} size={76} />
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <Text style={s.heading}>{entry.name}</Text>
              <Text style={[s.text, { fontSize: 13 }]}>{entry.condition}</Text>
            </View>
          </View>
          <BadgeProgress entry={entry} />
        </>
      ) : (
        <Text style={s.text}>
          Alle 12 digitalen Abzeichen sind freigeschaltet.
        </Text>
      )}
    </View>
  );
}
