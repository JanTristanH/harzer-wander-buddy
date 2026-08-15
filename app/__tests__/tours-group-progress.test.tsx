import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { TourCard } from '@/app/(tabs)/tours';
import type { Tour } from '@/lib/api';

function makeTour(overrides: Partial<Tour> = {}): Tour {
  return {
    ID: 'tour-1',
    name: 'Brockenrunde',
    distance: 12_300,
    duration: 8_100,
    stampCount: 8,
    newStampCountForUser: 3,
    idListTravelTimes: '',
    totalElevationGain: 420,
    totalElevationLoss: 415,
    averageGroupStampings: 5,
    ...overrides,
  };
}

describe('TourCard group progress', () => {
  it('keeps the current-user metric and adds progress for an active group', () => {
    render(
      <TourCard
        groupActive
        item={makeTour()}
        normalizedCurrentUserId={null}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Stempel gesamt: 8 • Neue Stempel für mich: 3')).toBeTruthy();
    expect(screen.getByText('Gruppenfortschritt: 5 / 8')).toBeTruthy();
  });

  it('hides group progress without a selected friend', () => {
    render(
      <TourCard
        item={makeTour()}
        normalizedCurrentUserId={null}
        onPress={jest.fn()}
      />
    );

    expect(screen.queryByText(/Gruppenfortschritt:/)).toBeNull();
  });
});
