import { fireEvent, render, screen } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { ClearableSearchInput } from '@/components/clearable-search-input';

function SearchableList() {
  const [query, setQuery] = useState('');
  return (
    <View>
      <ClearableSearchInput placeholder="Stempel suchen" value={query} onChangeText={setQuery} />
      {['Brocken', 'Torfhaus'].filter((name) => name.toLowerCase().includes(query.toLowerCase())).map((name) => (
        <Text key={name}>{name}</Text>
      ))}
    </View>
  );
}

describe('ClearableSearchInput', () => {
  it('restores the unfiltered list with a tap, including when the input is blurred', () => {
    render(<SearchableList />);
    const input = screen.getByPlaceholderText('Stempel suchen');
    expect(screen.queryByRole('button', { name: 'Suche leeren' })).toBeNull();

    fireEvent.changeText(input, 'Brocken');
    expect(screen.queryByText('Torfhaus')).toBeNull();
    fireEvent(input, 'blur');
    fireEvent.press(screen.getByRole('button', { name: 'Suche leeren' }));

    expect(input.props.value).toBe('');
    expect(screen.getByText('Brocken')).toBeTruthy();
    expect(screen.getByText('Torfhaus')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suche leeren' })).toBeNull();
  });

  it('does not offer a clear action for disabled searches', () => {
    render(<ClearableSearchInput editable={false} value="Brocken" onChangeText={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Suche leeren' })).toBeNull();
  });
});
