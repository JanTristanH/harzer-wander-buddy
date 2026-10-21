import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import type { AuthenticatedImageSource } from '@/lib/images';

// Browsers can desaturate images directly; importing the native SVG filter
// implementation would also ship the entire react-native-svg runtime.
export function UncollectedStampArtwork({ source, style }: {
  source: Exclude<AuthenticatedImageSource, string>;
  style: StyleProp<ImageStyle>;
}) {
  return (
    <View style={[style, { filter: 'grayscale(1)', overflow: 'hidden' }]}>
      <Image
        source={source}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        testID="stamp-artwork-uncollected"
      />
    </View>
  );
}
