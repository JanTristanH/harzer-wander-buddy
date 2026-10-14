import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BadgeEntry } from '@/lib/badge-types';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

const frames = [
  'bronze',
  'silver',
  'gold',
  'king',
  'backpack',
  'steiger',
  'shoe',
  'emperor',
  'prince',
];
const atlas = require('@/assets/images/badges/metal-frames.png');
const lockedAtlas = require('@/assets/images/badges/metal-frames-locked.png');
// Atlas bounds isolate each generated frame, including crowns, without leaking
// neighbouring cells into the avatar/medal. Coordinates refer to the 1254 atlas.
const bounds = [
  [40, 24, 382, 376],
  [437, 24, 379, 375],
  [831, 24, 381, 376],
  [42, 404, 380, 412],
  [440, 439, 373, 372],
  [831, 436, 383, 379],
  [43, 845, 380, 374],
  [436, 811, 380, 410],
  [834, 818, 372, 401],
];

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
  const index = frames.indexOf(entry?.frame || frame || '');
  const centerSize = size * 0.57;
  const rect = bounds[index];
  const scale = rect ? size / Math.max(rect[2], rect[3]) : 1;
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
      {rect ? (
        <View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: rect[2] * scale,
              height: rect[3] * scale,
              overflow: 'hidden',
              opacity: locked ? 0.65 : 1,
            },
          ]}
        >
          <Image
            source={locked ? lockedAtlas : atlas}
            contentFit="fill"
            style={{
              position: 'absolute',
              width: 1254 * scale,
              height: 1254 * scale,
              left: -rect[0] * scale,
              top: -rect[1] * scale,
            }}
          />
        </View>
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
