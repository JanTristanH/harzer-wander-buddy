import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { LockedGuestRows, SignInRequiredScreen } from '@/components/auth-locked-state';

describe('Auth locked-state user interaction', () => {
  it('fires onSignIn from the inline guest rows CTA', () => {
    const onSignIn = jest.fn();
    render(<LockedGuestRows onSignIn={onSignIn} />);

    fireEvent.press(screen.getByText('Anmelden'));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('renders a custom CTA label for the guest rows', () => {
    render(<LockedGuestRows ctaLabel="Jetzt einloggen" onSignIn={jest.fn()} />);

    expect(screen.getByText('Jetzt einloggen')).toBeTruthy();
  });

  it('fires onSignIn from the full sign-in screen CTA', () => {
    const onSignIn = jest.fn();
    render(
      <SignInRequiredScreen
        body="Bitte melde dich an."
        ctaLabel="Anmelden"
        onSignIn={onSignIn}
        title="Anmeldung erforderlich"
      />
    );

    expect(screen.getByText('Anmeldung erforderlich')).toBeTruthy();
    fireEvent.press(screen.getByText('Anmelden'));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
