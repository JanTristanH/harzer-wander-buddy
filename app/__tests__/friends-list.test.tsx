import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { FriendsList, type FriendsListItem } from '@/components/friends-list';

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ accessToken: null }),
}));

describe('FriendsList user interaction', () => {
  it('fires onPress when a friend row is tapped', () => {
    const onPress = jest.fn();
    const items: FriendsListItem[] = [
      { id: '1', name: 'Anna', subtitle: '128 Stempel', onPress },
    ];
    render(<FriendsList items={items} />);

    fireEvent.press(screen.getByText('Anna'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires the inline action when its button is pressed', () => {
    const onActionPress = jest.fn();
    const items: FriendsListItem[] = [
      { id: '1', name: 'Bea', actionLabel: 'Hinzufuegen', onActionPress },
    ];
    render(<FriendsList items={items} />);

    fireEvent.press(screen.getByText('Hinzufuegen'));

    expect(onActionPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire a disabled inline action', () => {
    const onActionPress = jest.fn();
    const items: FriendsListItem[] = [
      { id: '1', name: 'Cara', actionLabel: 'Ausstehend', actionDisabled: true, onActionPress },
    ];
    render(<FriendsList items={items} />);

    fireEvent.press(screen.getByText('Ausstehend'));

    expect(onActionPress).not.toHaveBeenCalled();
  });
});
