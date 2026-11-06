import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BadgeProfileSection } from '@/components/badge-profile-section';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/badge-artwork', () => ({ BadgeArtwork: () => null }));
test('offers the album link without duplicate editing controls', () => {
  render(<BadgeProfileSection own />);
  fireEvent.press(screen.getByText('Alle Abzeichen entdecken'));
  expect(mockPush).toHaveBeenCalledWith('/profile/badges');
  expect(screen.queryByText('Abzeichen, Titel und Rahmen auswählen')).toBeNull();
});
test('keeps editing controls off other profiles', () => {
  render(<BadgeProfileSection own={false} />);
  expect(screen.queryByText('Alle Abzeichen entdecken')).toBeNull();
});

test('the owner sees selected achievements without empty editable slots', () => {
  const album = {
    entries: [{ id: 'bronze', name: 'Bronze' }],
    selection: { featured: ['bronze'] },
  } as any;
  render(<BadgeProfileSection own album={album} />);
  expect(screen.getByText('Bronze')).toBeTruthy();
  expect(screen.queryByText('Abzeichen hinzufügen')).toBeNull();
  expect(screen.queryByLabelText('Bronze bearbeiten')).toBeNull();
  fireEvent.press(screen.getByLabelText('Bronze ansehen'));
  expect(mockPush).toHaveBeenCalledWith('/profile/badges/bronze');
});
