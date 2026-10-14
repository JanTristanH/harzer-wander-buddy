import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Platform, type ImageStyle, type StyleProp, View } from 'react-native';
import { FilterImage } from 'react-native-svg/filter-image';

import type { AuthenticatedImageSource } from '@/lib/images';

export function UncollectedStampArtwork({
  source,
  style,
}: {
  source: Exclude<AuthenticatedImageSource, string>;
  style: StyleProp<ImageStyle>;
}) {
  const [cachedImage, setCachedImage] = useState<{ uri: string; originalUri: string } | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;

    // SVG's Android image loader does not forward authorization headers.
    // Download with Expo's authenticated disk cache, then filter the local file.
    async function loadImage() {
      try {
        let path = await Image.getCachePathAsync(source.cacheKey);
        if (!path) {
          await Image.prefetch(source.uri, { headers: source.headers, cachePolicy: 'disk' });
          path = await Image.getCachePathAsync(source.cacheKey);
        }
        if (active && path) {
          setCachedImage({
            uri: path.startsWith('file://') ? path : `file://${path}`,
            originalUri: source.uri,
          });
        }
      } catch {
        // Keep the placeholder when an image cannot be loaded (e.g. offline).
      }
    }
    void loadImage();
    return () => {
      active = false;
    };
  }, [source.cacheKey, source.uri, source.headers]);

  const filteredSource = Platform.OS === 'web'
    ? source
    : cachedImage?.originalUri === source.uri ? { uri: cachedImage.uri } : null;

  return filteredSource ? (
    <FilterImage
      filters={[{ name: 'feColorMatrix', type: 'saturate', values: [0] }]}
      resizeMode="cover"
      source={filteredSource}
      style={style}
      testID="stamp-artwork-uncollected"
    />
  ) : <View style={[style, { backgroundColor: '#e1e1e1' }]} />;
}
