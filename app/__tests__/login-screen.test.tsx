import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import LoginScreen from '@/app/login';
import { useAuth } from '@/lib/auth';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(),
}));

let mockAuthMode = 'sso';
jest.mock('@/lib/config', () => ({
  appConfig: { get authMode() { return mockAuthMode; } },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function buildAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    authError: null,
    configError: null,
    hasCompletedOnboarding: true,
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn(),
    signup: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>;
}

describe('LoginScreen user interaction', () => {
  beforeEach(() => { mockAuthMode = 'sso'; });

  it('submits Basic credentials from the form and hides signup', () => {
    mockAuthMode = 'basic';
    const login = jest.fn();
    mockUseAuth.mockReturnValue(buildAuth({ login }));
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Nutzername'), 'user1@hwb.de');
    fireEvent.changeText(screen.getByLabelText('Passwort'), 'test-password');
    fireEvent.press(screen.getByText('Anmelden'));
    expect(login).toHaveBeenCalledWith('user1@hwb.de', 'test-password');
    expect(screen.queryByText('Konto erstellen')).toBeNull();
  });
  it('calls login when the "Anmelden" button is pressed', () => {
    const login = jest.fn();
    mockUseAuth.mockReturnValue(buildAuth({ login }));
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Anmelden'));

    expect(login).toHaveBeenCalledTimes(1);
  });

  it('calls signup when the "Konto erstellen" button is pressed', () => {
    const signup = jest.fn();
    mockUseAuth.mockReturnValue(buildAuth({ signup }));
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Konto erstellen'));

    expect(signup).toHaveBeenCalledTimes(1);
  });

  it('does not call login while a config error blocks the form', () => {
    const login = jest.fn();
    mockUseAuth.mockReturnValue(buildAuth({ configError: 'Missing OAuth config', login }));
    render(<LoginScreen />);

    expect(screen.getByText('Missing OAuth config')).toBeTruthy();
    fireEvent.press(screen.getByText('Anmelden'));

    expect(login).not.toHaveBeenCalled();
  });

  it('surfaces an auth error message', () => {
    mockUseAuth.mockReturnValue(buildAuth({ authError: 'Login fehlgeschlagen' }));
    render(<LoginScreen />);

    expect(screen.getByText('Login fehlgeschlagen')).toBeTruthy();
  });
});

it('submits Supabase signup and password reset using the entered email', () => {
  const signup = jest.fn(), resetPassword = jest.fn();
  mockUseAuth.mockReturnValue(buildAuth({ signup, resetPassword }));
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText('E-Mail'), 'test@example.invalid');
  fireEvent.changeText(screen.getByLabelText('Passwort'), 'test-only-password');
  fireEvent.press(screen.getByText('Konto erstellen'));
  expect(signup).toHaveBeenCalledWith('test@example.invalid', 'test-only-password');
  fireEvent.press(screen.getByText('Passwort vergessen'));
  expect(resetPassword).toHaveBeenCalledWith('test@example.invalid');
});
it('allows an authenticated recovery session to submit a new password', () => {
  const updatePassword = jest.fn();
  mockUseAuth.mockReturnValue(buildAuth({ isAuthenticated: true, passwordRecovery: true, updatePassword }));
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText('Passwort'), 'new-test-only-password');
  fireEvent.press(screen.getByText('Neues Passwort speichern'));
  expect(updatePassword).toHaveBeenCalledWith('new-test-only-password');
});
