import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BadgeProfileSection } from '@/components/badge-profile-section';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/badge-artwork', () => ({ BadgeArtwork: () => null }));
test('offers direct album and customization links even while badges load', () => {
  render(<BadgeProfileSection own />);
  fireEvent.press(screen.getByText('Alle Abzeichen entdecken'));
  expect(mockPush).toHaveBeenCalledWith('/profile/badges');
  fireEvent.press(screen.getByText('Abzeichen, Titel und Rahmen auswählen'));
  expect(mockPush).toHaveBeenCalledWith('/profile/badges/customize');
});
test('keeps editing controls off other profiles', () => {
  render(<BadgeProfileSection own={false} />);
  expect(screen.queryByText('Alle Abzeichen entdecken')).toBeNull();
});
