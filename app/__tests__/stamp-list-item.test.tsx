import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { StampListItem } from '@/components/stamp-list-item';
import type { Stampbox } from '@/lib/api';

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ accessToken: null }),
}));

function makeStamp(overrides: Partial<Stampbox> = {}): Stampbox {
  return {
    ID: 'stamp-1',
    number: '12',
    name: 'Brocken',
    description: 'Höchster Berg im Harz',
    hasVisited: false,
    ...overrides,
  };
}

describe('StampListItem user interaction', () => {
  it('fires onPress when the card is tapped', () => {
    const onPress = jest.fn();
    render(<StampListItem index={0} item={makeStamp()} onPress={onPress} />);

    fireEvent.press(screen.getByText(/Brocken/));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the "Unbesucht" pill for unvisited stamps', () => {
    render(<StampListItem index={0} item={makeStamp({ hasVisited: false })} onPress={jest.fn()} />);

    expect(screen.getByText('Unbesucht')).toBeTruthy();
  });

  it('renders the "Besucht" pill for visited stamps', () => {
    render(<StampListItem index={1} item={makeStamp({ hasVisited: true })} onPress={jest.fn()} />);

    expect(screen.getByText('Besucht')).toBeTruthy();
  });

  it('shows the optional meta label when provided', () => {
    render(
      <StampListItem index={0} item={makeStamp()} metaLabel="2,4 km entfernt" onPress={jest.fn()} />
    );

    expect(screen.getByText('2,4 km entfernt')).toBeTruthy();
  });
});
