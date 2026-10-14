import { render, screen, waitFor } from '@testing-library/react-native';
import { Image } from 'expo-image';
import React from 'react';
import { FilterImage } from 'react-native-svg/filter-image';

import { UncollectedStampArtwork } from '@/components/uncollected-stamp-artwork';

jest.mock('expo-image', () => ({
  Image: { getCachePathAsync: jest.fn(), prefetch: jest.fn() },
}));

const source = {
  uri: 'https://backend.test/hero.jpg',
  cacheKey: 'https://backend.test/hero.jpg',
  headers: { Authorization: 'Bearer test-token' },
};
const style = { width: 64, height: 64, borderRadius: 14 };

describe('UncollectedStampArtwork native image loading', () => {
  beforeEach(() => jest.resetAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('uses the authenticated disk cache before filtering a local image', async () => {
    jest.spyOn(Image, 'getCachePathAsync').mockResolvedValueOnce(null).mockResolvedValue('/cache/hero.jpg');
    const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    render(<UncollectedStampArtwork source={source} style={style} />);

    await waitFor(() => expect(screen.UNSAFE_getByType(FilterImage)).toBeTruthy());
    expect(prefetch).toHaveBeenCalledWith(source.uri, { headers: source.headers, cachePolicy: 'disk' });
    expect(screen.UNSAFE_getByType(FilterImage).props.source).toEqual({ uri: 'file:///cache/hero.jpg' });
    expect(screen.UNSAFE_getByType(FilterImage).props.filters).toEqual([
      { name: 'feColorMatrix', type: 'saturate', values: [0] },
    ]);
  });

  it('reuses an already cached image without a network download', async () => {
    jest.spyOn(Image, 'getCachePathAsync').mockResolvedValue('file:///cache/hero.jpg');
    const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    render(<UncollectedStampArtwork source={source} style={style} />);

    await waitFor(() => expect(screen.UNSAFE_getByType(FilterImage)).toBeTruthy());
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('does not display a previous stamp image while the next one loads', async () => {
    jest.spyOn(Image, 'getCachePathAsync').mockResolvedValueOnce('/cache/hero.jpg').mockResolvedValue(null);
    jest.spyOn(Image, 'prefetch').mockResolvedValue(false);
    const { rerender } = render(<UncollectedStampArtwork source={source} style={style} />);
    await waitFor(() => expect(screen.UNSAFE_getByType(FilterImage)).toBeTruthy());

    rerender(<UncollectedStampArtwork source={{ uri: 'https://backend.test/next.jpg', cacheKey: 'next' }} style={style} />);
    await waitFor(() => expect(screen.UNSAFE_queryByType(FilterImage)).toBeNull());
  });
});
