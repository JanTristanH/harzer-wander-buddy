import {
  MAP_VIEWPORT_PADDING_RATIO,
  areMapCoordinatesEqual,
  isCoordinateInPaddedRegion,
} from '@/lib/map-viewport';

describe('map viewport helpers', () => {
  const region = {
    latitude: 51.75,
    longitude: 10.62,
    latitudeDelta: 0.4,
    longitudeDelta: 0.4,
  };

  it('keeps coordinates in the viewport and its padding', () => {
    expect(MAP_VIEWPORT_PADDING_RATIO).toBe(0.25);
    expect(
      isCoordinateInPaddedRegion({ latitude: 51.75, longitude: 10.62 }, region)
    ).toBe(true);
    expect(
      isCoordinateInPaddedRegion({ latitude: 52.04, longitude: 10.62 }, region)
    ).toBe(true);
  });

  it('changes the rendered subset when the viewport moves', () => {
    const coordinates = [
      { id: 'west', latitude: 51.75, longitude: 10.2 },
      { id: 'east', latitude: 51.75, longitude: 11.2 },
    ];
    const westRegion = { ...region, longitude: 10.2, longitudeDelta: 0.2 };
    const eastRegion = { ...region, longitude: 11.2, longitudeDelta: 0.2 };

    expect(
      coordinates
        .filter((coordinate) => isCoordinateInPaddedRegion(coordinate, westRegion))
        .map((coordinate) => coordinate.id)
    ).toEqual(['west']);
    expect(
      coordinates
        .filter((coordinate) => isCoordinateInPaddedRegion(coordinate, eastRegion))
        .map((coordinate) => coordinate.id)
    ).toEqual(['east']);
  });

  it('removes coordinates well outside the padded viewport', () => {
    expect(
      isCoordinateInPaddedRegion({ latitude: 52.2, longitude: 10.62 }, region)
    ).toBe(false);
    expect(
      isCoordinateInPaddedRegion({ latitude: 51.75, longitude: 11.2 }, region)
    ).toBe(false);
  });

  it('handles longitude wrap-around', () => {
    expect(
      isCoordinateInPaddedRegion(
        { latitude: 0, longitude: -179.9 },
        {
          latitude: 0,
          longitude: 179.9,
          latitudeDelta: 1,
          longitudeDelta: 1,
        }
      )
    ).toBe(true);
  });

  it('deduplicates practically identical positions', () => {
    expect(
      areMapCoordinatesEqual(
        { latitude: 51.7500001, longitude: 10.6200001 },
        { latitude: 51.7500002, longitude: 10.6200002 }
      )
    ).toBe(true);
    expect(
      areMapCoordinatesEqual(
        { latitude: 51.75, longitude: 10.62 },
        { latitude: 51.751, longitude: 10.62 }
      )
    ).toBe(false);
  });
});
