import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { MapSelectionSheet } from '@/components/map-selection-sheet';

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ accessToken: null }),
}));

const baseItem = {
  kind: 'open-stamp' as const,
  title: 'Stempelstelle 12',
  description: 'Am Brocken',
};

describe('MapSelectionSheet user interaction', () => {
  it('expands the sheet when tapped in compact mode', () => {
    const onToggleExpand = jest.fn();
    render(
      <MapSelectionSheet
        bottomOffset={0}
        item={baseItem}
        mode="compact"
        onToggleExpand={onToggleExpand}
      />
    );

    fireEvent.press(screen.getByText('Stempelstelle 12'));

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('fires the primary action when its button is pressed', () => {
    const onPrimaryActionPress = jest.fn();
    render(
      <MapSelectionSheet
        bottomOffset={0}
        item={baseItem}
        mode="expanded"
        primaryActionLabel="Stempeln"
        onPrimaryActionPress={onPrimaryActionPress}
      />
    );

    fireEvent.press(screen.getByText('Stempeln'));

    expect(onPrimaryActionPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire the primary action when it is disabled', () => {
    const onPrimaryActionPress = jest.fn();
    render(
      <MapSelectionSheet
        bottomOffset={0}
        item={baseItem}
        mode="expanded"
        primaryActionLabel="Stempeln"
        primaryActionDisabled
        onPrimaryActionPress={onPrimaryActionPress}
      />
    );

    fireEvent.press(screen.getByText('Stempeln'));

    expect(onPrimaryActionPress).not.toHaveBeenCalled();
  });

  it('opens the details when the details action is pressed', () => {
    const onDetailsPress = jest.fn();
    render(
      <MapSelectionSheet
        bottomOffset={0}
        item={baseItem}
        mode="expanded"
        onDetailsPress={onDetailsPress}
      />
    );

    fireEvent.press(screen.getByText('Details oeffnen'));

    expect(onDetailsPress).toHaveBeenCalled();
  });
});
