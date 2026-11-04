import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { EmptyState } from '@/components/empty-state';

describe('EmptyState', () => {
  it('keeps an actionable friend search accessible', () => {
    const onSearch = jest.fn();
    render(<EmptyState title="Noch keine Freunde" body="Finde deine Wanderfreunde."
      ctaLabel="Freunde suchen" onCtaPress={onSearch} />);

    fireEvent.press(screen.getByRole('button', { name: 'Freunde suchen' }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Noch keine Freunde')).toBeTruthy();
  });

  it('renders a discovery message without a dead action', () => {
    render(<EmptyState title="Keine Touren gefunden" body="Ändere deine Suche."
      variant="discovery" ctaLabel="Suchen" />);

    expect(screen.getByText('Ändere deine Suche.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
