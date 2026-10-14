import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { StampListItem } from '@/components/stamp-list-item';
import { UncollectedStampArtwork } from '@/components/uncollected-stamp-artwork';
import type { Stampbox } from '@/lib/api';

const mockUseAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'http://localhost:4004' } }));

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
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ accessToken: null, isAuthenticated: false });
  });

  it('shows unvisited artwork in grayscale for signed-in users and restores color after visiting', () => {
    mockUseAuth.mockReturnValue({ accessToken: 'test-token', isAuthenticated: true });
    const item = makeStamp({ heroImageUrl: '/hero.jpg' });
    const { rerender } = render(<StampListItem index={0} item={item} onPress={jest.fn()} />);

    const artwork = screen.UNSAFE_getByType(UncollectedStampArtwork);
    expect(artwork.props.source.headers).toEqual({ Authorization: 'Bearer test-token' });

    rerender(<StampListItem index={0} item={{ ...item, hasVisited: true }} onPress={jest.fn()} />);
    expect(screen.UNSAFE_queryByType(UncollectedStampArtwork)).toBeNull();
    expect(screen.getByTestId('stamp-artwork-color')).toBeTruthy();
  });

  it('keeps guest artwork in color even for unvisited stamps', () => {
    render(<StampListItem index={0} item={makeStamp({ heroImageUrl: '/hero.jpg' })} onPress={jest.fn()} />);

    expect(screen.UNSAFE_queryByType(UncollectedStampArtwork)).toBeNull();
    expect(screen.getByTestId('stamp-artwork-color')).toBeTruthy();
  });

  it('uses the personal visit status even when every friend has collected the stamp', () => {
    mockUseAuth.mockReturnValue({ accessToken: 'test-token', isAuthenticated: true });
    render(
      <StampListItem
        groupActive
        groupMembers={[{ id: 'friend-1', name: 'Anna' }]}
        index={0}
        item={makeStamp({ image: '/legacy.jpg', stampedUserIds: ['friend-1'], totalGroupStampings: 1 })}
        onPress={jest.fn()}
      />
    );

    expect(screen.UNSAFE_getByType(UncollectedStampArtwork).props.source.uri).toContain('/legacy.jpg');
    expect(screen.getByText('1 von 2 in der Gruppe')).toBeTruthy();
  });

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

  it('shows group progress with the current user included in the total', () => {
    render(
      <StampListItem
        currentUser={{ name: 'Ich Selbst', picture: 'https://example.test/self.jpg' }}
        groupActive
        groupMembers={[
          {
            id: 'friend-1',
            name: 'Anna Adler',
            picture: 'https://example.test/anna.jpg',
          },
          { id: 'friend-2', name: 'Ben Berg' },
        ]}
        groupSize={3}
        index={0}
        item={makeStamp({
          hasVisited: true,
          stampedUserIds: ['friend-1'],
          totalGroupStampings: 2,
        })}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('2 von 3 in der Gruppe')).toBeTruthy();
    expect(
      screen.getByLabelText(/Du besucht, Anna Adler besucht, Ben Berg unbesucht/)
    ).toBeTruthy();
    expect(screen.getByTestId('group-member-avatar-self-image').props.source).toMatchObject({
      uri: 'https://example.test/self.jpg',
    });
    expect(screen.getByTestId('group-member-avatar-friend-1-image').props.source).toMatchObject({
      uri: 'https://example.test/anna.jpg',
    });
    expect(screen.getByTestId('group-member-avatar-friend-2-image')).toBeTruthy();
  });

  it('does not show group details when no friend selection is active', () => {
    render(
      <StampListItem
        groupMembers={[{ id: 'friend-1', name: 'Anna Adler' }]}
        groupSize={2}
        index={0}
        item={makeStamp({ totalGroupStampings: 1 })}
        onPress={jest.fn()}
      />
    );

    expect(screen.queryByText(/in der Gruppe/)).toBeNull();
  });

  it('supports JSON encoded stamped user ids returned by OData', () => {
    render(
      <StampListItem
        groupActive
        groupMembers={[{ id: 'friend-1', name: 'Anna Adler' }]}
        groupSize={2}
        index={0}
        item={makeStamp({
          stampedUserIds: '["friend-1"]',
          totalGroupStampings: 1,
        })}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByLabelText(/Anna Adler besucht/)).toBeTruthy();
  });
});
