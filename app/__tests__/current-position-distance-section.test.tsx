import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { CurrentPositionDistanceSection } from '@/components/current-position-distance-section';

describe('CurrentPositionDistanceSection', () => {
  it.each([
    ['idle', 'Distanz berechnen'],
    ['denied', 'Erneut versuchen'],
    ['error', 'Standort erneut laden'],
  ] as const)('requests the location from the %s state', (status, label) => {
    const onRequestDistance = jest.fn();
    render(<CurrentPositionDistanceSection title="Von aktueller Position" status={status}
      noCoordinatesText="Keine Koordinaten" promptText="Standort freigeben"
      errorText="Standort nicht verfügbar" errorActionLabel="Standort erneut laden"
      onRequestDistance={onRequestDistance}><Text>3 km</Text></CurrentPositionDistanceSection>);

    fireEvent.press(screen.getByText(label));

    expect(onRequestDistance).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('3 km')).toBeNull();
  });

  it('shows distance content only when ready', () => {
    const { rerender } = render(
      <CurrentPositionDistanceSection title="Distanz" status="no-coordinates" noCoordinatesText="Keine Koordinaten">
        <Text>3 km</Text>
      </CurrentPositionDistanceSection>,
    );
    expect(screen.getByText('Keine Koordinaten')).toBeTruthy();
    expect(screen.queryByText('3 km')).toBeNull();

    rerender(<CurrentPositionDistanceSection title="Distanz" status="ready" noCoordinatesText="Keine Koordinaten">
      <Text>3 km</Text>
    </CurrentPositionDistanceSection>);
    expect(screen.getByText('3 km')).toBeTruthy();
    expect(screen.queryByText('Keine Koordinaten')).toBeNull();
  });
});
