import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Stampbox } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

function cardGradient(index: number, visited: boolean) {
  if (visited) {
    return index % 2 === 0
      ? (['#458962', '#8fd2a4'] as const)
      : (['#4a8464', '#c2dfae'] as const);
  }

  return index % 2 === 0
    ? (['#b6beac', '#e1d2bd'] as const)
    : (['#a6b39c', '#d7cfbb'] as const);
}

export function StampListItem({
  item,
  index,
  onPress,
  metaLabel,
}: {
  item: Stampbox;
  index: number;
  onPress: () => void;
  metaLabel?: string | null;
}) {
  const { accessToken } = useAuth();
  const artworkUri = item.heroImageUrl?.trim() || item.image?.trim() || '';
  const artworkSource = artworkUri ? buildAuthenticatedImageSource(artworkUri, accessToken) : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {artworkSource ? (
        <Image cachePolicy="disk" contentFit="cover" source={artworkSource} style={styles.cardArtwork} />
      ) : (
        <LinearGradient colors={cardGradient(index, !!item.hasVisited)} style={styles.cardArtwork} />
      )}

      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.number || '--'} {'\u2022'} {item.name}
        </Text>
        <Text numberOfLines={2} style={styles.cardDescription}>
          {item.description?.trim() || 'Keine Beschreibung verfuegbar.'}
        </Text>

        <View style={styles.cardMetaRow}>
          <View style={[styles.statePill, item.hasVisited ? styles.statePillVisited : styles.statePillOpen]}>
            <Feather
              color={item.hasVisited ? '#2e6b4b' : '#7a6a4a'}
              name={item.hasVisited ? 'check' : 'x'}
              size={11}
            />
            <Text
              style={[
                styles.statePillLabel,
                item.hasVisited ? styles.statePillLabelVisited : styles.statePillLabelOpen,
              ]}>
              {item.hasVisited ? 'Besucht' : 'Unbesucht'}
            </Text>
          </View>
          {metaLabel ? <Text style={styles.distanceLabel}>{metaLabel}</Text> : null}
        </View>
      </View>

      <Feather color="#8b957f" name="chevron-right" size={18} style={styles.cardChevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardArtwork: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  cardBody: {
    flex: 1,
    minWidth: 1,
  },
  cardTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  cardDescription: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statePillVisited: {
    backgroundColor: '#e2eee6',
  },
  statePillOpen: {
    backgroundColor: '#f0e9dd',
  },
  statePillLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  statePillLabelVisited: {
    color: '#2e6b4b',
  },
  statePillLabelOpen: {
    color: '#7a6a4a',
  },
  distanceLabel: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  cardChevron: {
    flexShrink: 0,
  },
});
