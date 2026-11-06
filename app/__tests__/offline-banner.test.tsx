import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { OfflineBanner } from '@/components/offline-banner';

it('opens details and announces the pending count', () => {
  const open = jest.fn();
  render(<OfflineBanner label="Offline" count={2} expanded={false} onPress={open} />);
  fireEvent.press(screen.getByRole('button', { name: /2 Änderungen ausstehend/ }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(screen.getByText('2')).toBeTruthy();
});

it('keeps the offline control available without a pending badge', () => {
  render(<OfflineBanner label="Offline" count={0} expanded={false} onPress={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Offline. Synchronisierungsstatus anzeigen' })).toBeTruthy();
  expect(screen.queryByText('0')).toBeNull();
});
