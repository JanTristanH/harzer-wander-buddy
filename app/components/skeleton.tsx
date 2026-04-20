import React from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

type SkeletonTone = 'base' | 'muted' | 'strong';

function resolveToneColor(tone: SkeletonTone) {
  switch (tone) {
    case 'muted':
      return '#ECE6DA';
    case 'strong':
      return '#DDD5C7';
    case 'base':
    default:
      return '#E6E0D4';
  }
}

export function SkeletonBlock({
  width = '100%',
  height = 14,
  radius = 10,
  tone = 'base',
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  tone?: SkeletonTone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: resolveToneColor(tone),
        },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({
  size,
  tone = 'base',
  style,
}: {
  size: number;
  tone?: SkeletonTone;
  style?: StyleProp<ViewStyle>;
}) {
  return <SkeletonBlock height={size} radius={size / 2} style={style} tone={tone} width={size} />;
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
});
