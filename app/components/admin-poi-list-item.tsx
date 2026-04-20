import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ParkingSpot, Stampbox } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

type AdminPoiListItemValue = Partial<Pick<Stampbox, 'name' | 'description' | 'image' | 'heroImageUrl'>> &
  Pick<ParkingSpot, 'ID'> & {
    badgeLabel: string;
  };

export function AdminPoiListItem({
  item,
  index,
  metaLabel,
  onPress,
}: {
  item: AdminPoiListItemValue;
  index: number;
  metaLabel?: string | null;
  onPress: () => void;
}) {
  const { accessToken } = useAuth();
  const artworkUri = item.heroImageUrl?.trim() || item.image?.trim() || '';
  const artworkSource = artworkUri ? buildAuthenticatedImageSource(artworkUri, accessToken) : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {artworkSource ? (
        <Image cachePolicy="disk" contentFit="cover" source={artworkSource} style={styles.cardArtwork} />
      ) : (
        <LinearGradient colors={index % 2 === 0 ? ['#c8d4bf', '#eadcc8'] : ['#b5c7a8', '#ddd3c4']} style={styles.cardArtwork} />
      )}

      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.name?.trim() || item.badgeLabel}
        </Text>
        <Text numberOfLines={2} style={styles.cardDescription}>
          {item.description?.trim() || 'Keine Beschreibung verfuegbar.'}
        </Text>

        <View style={styles.cardMetaRow}>
          <View style={styles.statePill}>
            <Text style={styles.statePillLabel}>{item.badgeLabel}</Text>
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
    borderRadius: 999,
    backgroundColor: '#e5efe7',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statePillLabel: {
    color: '#2e6b4b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
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
