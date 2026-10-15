import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BadgeEntry } from '@/lib/badge-types';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

// Individual transparent assets avoid atlas coordinates and neighbouring frame bleed.
const frames: Record<string, { active: number; locked: number }> = {
  bronze: {
    active: require('@/assets/images/badges/bronze.png'),
    locked: require('@/assets/images/badges/bronze-locked.png'),
  },
  silver: {
    active: require('@/assets/images/badges/silver.png'),
    locked: require('@/assets/images/badges/silver-locked.png'),
  },
  gold: {
    active: require('@/assets/images/badges/gold.png'),
    locked: require('@/assets/images/badges/gold-locked.png'),
  },
  king: {
    active: require('@/assets/images/badges/king.png'),
    locked: require('@/assets/images/badges/king-locked.png'),
  },
  backpack: {
    active: require('@/assets/images/badges/backpack.png'),
    locked: require('@/assets/images/badges/backpack-locked.png'),
  },
  steiger: {
    active: require('@/assets/images/badges/steiger.png'),
    locked: require('@/assets/images/badges/steiger-locked.png'),
  },
  shoe: {
    active: require('@/assets/images/badges/shoe.png'),
    locked: require('@/assets/images/badges/shoe-locked.png'),
  },
  emperor: {
    active: require('@/assets/images/badges/emperor.png'),
    locked: require('@/assets/images/badges/emperor-locked.png'),
  },
  prince: {
    active: require('@/assets/images/badges/prince.png'),
    locked: require('@/assets/images/badges/prince-locked.png'),
  },
  goethe: {
    active: require('@/assets/images/badges/goethe.png'),
    locked: require('@/assets/images/badges/goethe-locked.png'),
  },
  witch: {
    active: require('@/assets/images/badges/witch.png'),
    locked: require('@/assets/images/badges/witch-locked.png'),
  },
  border: {
    active: require('@/assets/images/badges/border.png'),
    locked: require('@/assets/images/badges/border-locked.png'),
  },
};

export function BadgeArtwork({
  entry,
  frame,
  size = 100,
  image,
  initials,
  locked = false,
}: {
  entry?: BadgeEntry;
  frame?: string;
  size?: number;
  image?: string;
  initials?: string;
  locked?: boolean;
}) {
  const { accessToken } = useAuth();
  const frameId = entry?.frame || frame || '';
  const artwork = frames[frameId];
  const centerSize = size * (['prince', 'goethe', 'witch', 'border'].includes(frameId) ? 0.7 : 0.57);
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={[
          styles.center,
          {
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
            backgroundColor: locked ? '#e4e3df' : '#f5f3ee',
          },
        ]}
      >
        {image ? (
          <Image
            source={buildAuthenticatedImageSource(image, accessToken)}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
        ) : initials ? (
          <Text
            style={{
              fontSize: size * 0.2,
              color: '#203829',
              fontWeight: '700',
            }}
          >
            {initials}
          </Text>
        ) : (
          <Feather
            name={entry?.icon || 'feather'}
            size={size * 0.28}
            color={locked ? '#767973' : '#2e6b4b'}
          />
        )}
      </View>
      {artwork ? (
        <Image
          pointerEvents="none"
          source={locked ? artwork.locked : artwork.active}
          contentFit="contain"
          style={[StyleSheet.absoluteFill, { opacity: locked ? 0.65 : 1 }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderWidth: 2, borderColor: '#d9dfd7', borderRadius: size / 2 },
          ]}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  center: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
