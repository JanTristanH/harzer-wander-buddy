import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { OfflineBanner } from '@/components/offline-banner';
import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/lib/connectivity';

jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/connectivity', () => ({ useConnectivity: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConnectivity = useConnectivity as jest.MockedFunction<typeof useConnectivity>;

function mockState(auth: Partial<ReturnType<typeof useAuth>>, isOffline: boolean) {
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    sessionMode: 'online',
    ...auth,
  } as unknown as ReturnType<typeof useAuth>);
  mockUseConnectivity.mockReturnValue({ isOffline } as ReturnType<typeof useConnectivity>);
}

describe('OfflineBanner user-facing behaviour', () => {
  it('shows the offline warning when authenticated and offline', () => {
    mockState({ isAuthenticated: true, sessionMode: 'online' }, true);
    render(<OfflineBanner />);

    expect(screen.getByText(/Offline: Lokale Daten/i)).toBeTruthy();
  });

  it('shows the grace-mode wording in offline_grace mode', () => {
    mockState({ isAuthenticated: true, sessionMode: 'offline_grace' }, true);
    render(<OfflineBanner />);

    expect(screen.getByText(/Offline-Modus: Lokale Daten/i)).toBeTruthy();
  });

  it('renders nothing while online', () => {
    mockState({ isAuthenticated: true, sessionMode: 'online' }, false);
    const { toJSON } = render(<OfflineBanner />);

    expect(toJSON()).toBeNull();
  });

  it('renders nothing for an unauthenticated user even when offline', () => {
    mockState({ isAuthenticated: false, sessionMode: 'online' }, true);
    const { toJSON } = render(<OfflineBanner />);

    expect(toJSON()).toBeNull();
  });
});
