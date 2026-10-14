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

  it('opens group stamping from the dedicated action', () => {
    const onGroupActionPress = jest.fn();
    render(
      <MapSelectionSheet
        bottomOffset={0}
        groupActionLabel="Gruppe stempeln"
        item={baseItem}
        mode="expanded"
        onGroupActionPress={onGroupActionPress}
      />
    );

    fireEvent.press(screen.getByText('Gruppe stempeln'));

    expect(onGroupActionPress).toHaveBeenCalledTimes(1);
  });

  it('replaces the personal stamping action when a group action is provided', () => {
    const onGroupActionPress = jest.fn();
    const onPrimaryActionPress = jest.fn();
    render(
      <MapSelectionSheet
        bottomOffset={0}
        groupActionLabel="Gruppe stempeln"
        item={baseItem}
        mode="expanded"
        onGroupActionPress={onGroupActionPress}
        onPrimaryActionPress={onPrimaryActionPress}
        primaryActionLabel="Besuch registrieren"
      />
    );

    expect(screen.queryByText('Besuch registrieren')).toBeNull();
    fireEvent.press(screen.getByText('Gruppe stempeln'));

    expect(onGroupActionPress).toHaveBeenCalledTimes(1);
    expect(onPrimaryActionPress).not.toHaveBeenCalled();
  });
});

const groupStatus = {
  item: { hasVisited: true, stampedUserIds: '["anna"]', totalGroupStampings: 2 },
  currentUser: { name: 'Max Wanderer', picture: 'https://example.test/max.jpg' },
  groupMembers: [{ id: 'anna', name: 'Anna Adler', picture: 'https://example.test/anna.jpg' },
    { id: 'ben', name: 'Ben Berg' }],
  groupSize: 3,
};

describe('MapSelectionSheet group status', () => {
  it.each(['expanded', 'compact'] as const)('shows member visits in %s mode', (mode) => {
    render(<MapSelectionSheet bottomOffset={0} item={baseItem} mode={mode} groupStatus={groupStatus} />);
    expect(screen.getByText('2 von 3 in der Gruppe')).toBeTruthy();
    expect(screen.getByLabelText('Du: besucht')).toBeTruthy();
    expect(screen.getByLabelText('Anna Adler: besucht')).toBeTruthy();
    expect(screen.getByLabelText('Ben Berg: unbesucht')).toBeTruthy();
    expect(screen.getByTestId('group-member-avatar-anna-image').props.source).toMatchObject({
      uri: 'https://example.test/anna.jpg',
    });
  });

  it('hides group status on parking sheets', () => {
    render(<MapSelectionSheet bottomOffset={0} item={{ ...baseItem, kind: 'parking' }} mode="expanded" groupStatus={groupStatus} />);
    expect(screen.queryByText(/in der Gruppe/)).toBeNull();
  });

  it('hides group status without a selected group', () => {
    render(<MapSelectionSheet bottomOffset={0} item={baseItem} mode="expanded" />);
    expect(screen.queryByTestId('group-member-avatar-self')).toBeNull();
  });
});
