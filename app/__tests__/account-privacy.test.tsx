import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AccountPrivacyScreen from '@/app/account-privacy';
import { deleteMyAccount } from '@/lib/api';
import { useAuth } from '@/lib/auth';

jest.mock('@/lib/api', () => ({ deleteMyAccount: jest.fn(), exportMyData: jest.fn() }));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
const logout = jest.fn();
const getValidAccessToken = jest.fn(async () => 'token');
beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isOffline: false, logout, getValidAccessToken });
});
test('deletion requires explicit confirmation and only logs out after successful server deletion', async () => {
  (deleteMyAccount as jest.Mock).mockResolvedValue('Deine App-Daten wurden gelöscht.');
  render(<AccountPrivacyScreen />);
  const deleteButton = screen.getAllByText('Konto endgültig löschen').at(-1)!;
  fireEvent.press(deleteButton);
  expect(deleteMyAccount).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Bestätigung der Kontolöschung'), 'LÖSCHEN');
  fireEvent.press(deleteButton);
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  expect(deleteMyAccount).toHaveBeenCalledWith('token');
  expect(screen.getByText('Deine App-Daten wurden gelöscht.')).toBeTruthy();
});
test('a failed deletion keeps the session and explains the error', async () => {
  (deleteMyAccount as jest.Mock).mockRejectedValue(new Error('Vorübergehend nicht verfügbar'));
  render(<AccountPrivacyScreen />);
  fireEvent.changeText(screen.getByLabelText('Bestätigung der Kontolöschung'), 'LÖSCHEN');
  fireEvent.press(screen.getAllByText('Konto endgültig löschen').at(-1)!);
  await waitFor(() => expect(screen.getByText('Vorübergehend nicht verfügbar')).toBeTruthy());
  expect(logout).not.toHaveBeenCalled();
});
test('guests can read legal links and see the account access path', () => {
  (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });
  render(<AccountPrivacyScreen />);
  expect(screen.getByText('Impressum')).toBeTruthy();
  expect(screen.getByText('Datenschutz')).toBeTruthy();
  expect(screen.getByText('Anmelden, um dein Konto zu verwalten')).toBeTruthy();
});
