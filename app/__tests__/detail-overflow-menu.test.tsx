import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { DetailOverflowMenu } from '@/components/detail-overflow-menu';

describe('DetailOverflowMenu user interaction', () => {
  it('renders nothing when there are no actions', () => {
    const { toJSON } = render(<DetailOverflowMenu actions={[]} topOffset={0} />);

    expect(toJSON()).toBeNull();
  });

  it('opens the popover when the trigger is pressed', () => {
    render(
      <DetailOverflowMenu
        actions={[{ key: 'share', label: 'Teilen', icon: 'share-2', onPress: jest.fn() }]}
        topOffset={40}
      />
    );

    expect(screen.queryByText('Aktionen')).toBeNull();

    fireEvent.press(screen.getByRole('button'));

    expect(screen.getByText('Aktionen')).toBeTruthy();
    expect(screen.getByText('Teilen')).toBeTruthy();
  });

  it('runs the action and closes the menu when an item is pressed', () => {
    const onPress = jest.fn();
    render(
      <DetailOverflowMenu
        actions={[{ key: 'delete', label: 'Loeschen', icon: 'trash-2', onPress }]}
        topOffset={40}
      />
    );

    fireEvent.press(screen.getByRole('button'));
    fireEvent.press(screen.getByText('Loeschen'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Aktionen')).toBeNull();
  });

  it('ignores presses on disabled actions', () => {
    const onPress = jest.fn();
    render(
      <DetailOverflowMenu
        actions={[{ key: 'edit', label: 'Bearbeiten', icon: 'edit-2', onPress, disabled: true }]}
        topOffset={40}
      />
    );

    fireEvent.press(screen.getByRole('button'));
    fireEvent.press(screen.getByText('Bearbeiten'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
