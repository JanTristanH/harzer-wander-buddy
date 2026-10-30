import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { StampNoteSection } from '@/components/stamp-note-section';

function setup(overrides: Partial<React.ComponentProps<typeof StampNoteSection>> = {}) {
  const onChangeNote = jest.fn();
  const onSave = jest.fn();
  const props: React.ComponentProps<typeof StampNoteSection> = {
    noteDraft: '',
    noteLength: 0,
    maxLength: 200,
    isSaving: false,
    isDirty: false,
    isTooLong: false,
    onChangeNote,
    onSave,
    ...overrides,
  };
  render(<StampNoteSection {...props} />);
  return { onChangeNote, onSave, props };
}

describe('StampNoteSection user interaction', () => {
  it('reports typed text through onChangeNote', () => {
    const { onChangeNote } = setup();

    fireEvent.changeText(screen.getByPlaceholderText(/persönliche Notiz/i), 'Tolle Aussicht');

    expect(onChangeNote).toHaveBeenCalledWith('Tolle Aussicht');
  });

  it('shows the character counter for the current length', () => {
    setup({ noteDraft: 'Hallo', noteLength: 5, maxLength: 200 });

    expect(screen.getByText('5/200')).toBeTruthy();
  });

  it('hides the save button until the draft is dirty', () => {
    setup({ isDirty: false });

    expect(screen.queryByText('Speichern')).toBeNull();
  });

  it('saves when the draft is dirty and the button is pressed', () => {
    const { onSave } = setup({ isDirty: true });

    fireEvent.press(screen.getByText('Speichern'));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not save while the note is too long', () => {
    const { onSave } = setup({ isDirty: true, isTooLong: true, noteLength: 250, maxLength: 200 });

    expect(screen.getByText(/Maximal 200 Zeichen/i)).toBeTruthy();
    fireEvent.press(screen.getByText('Speichern'));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a saving label and blocks extra saves while saving', () => {
    const { onSave } = setup({ isSaving: true });

    const button = screen.getByText('Speichert...');
    fireEvent.press(button);

    expect(onSave).not.toHaveBeenCalled();
  });
});

it('explains pending sync and offers a retry after an upload error', () => {
  const onRetry = jest.fn();
  setup({ syncStatus: 'Auf Gerät gespeichert · Synchronisierung ausstehend', onRetry });
  expect(screen.getByText(/Auf Gerät gespeichert/)).toBeTruthy();
  fireEvent.press(screen.getByText('Synchronisierung erneut versuchen'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
it('shows the remote version and explicit conflict choices', () => {
  const onResolve = jest.fn();
  setup({ syncStatus: 'Konflikt', remoteNote: 'Zweites Gerät', onResolve });
  expect(screen.getByText('Andere Fassung: Zweites Gerät')).toBeTruthy();
  fireEvent.press(screen.getByText('Meine gespeicherte Fassung übernehmen'));
  fireEvent.press(screen.getByText('Andere Fassung übernehmen'));
  expect(onResolve.mock.calls).toEqual([['local'], ['remote']]);
});
it('protects unsaved edits from conflict resolution until saved', () => {
  const onResolve = jest.fn(); setup({ remoteNote: '', isDirty: true, onResolve });
  fireEvent.press(screen.getByText('Andere Fassung übernehmen'));
  expect(onResolve).not.toHaveBeenCalled();
  expect(screen.getByText('Änderungen vor der Auswahl speichern.')).toBeTruthy();
});
