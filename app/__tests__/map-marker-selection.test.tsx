import { render } from '@testing-library/react-native';
import React from 'react';

import { selectMapMarker } from '@/lib/map-marker-selection';

it('updates only the previous and next pin, and clears selection when the sheet closes', () => {
  const renders = jest.fn();
  function Pin({ identifier, selected = false }: { identifier: string; selected?: boolean }) {
    renders(identifier, selected);
    return null;
  }
  const markers = ['9', '10', '11'].map(id => <Pin key={id} identifier={id} />);
  const view = render(<>{selectMapMarker(markers, null)}</>);
  renders.mockClear();
  view.rerender(<>{selectMapMarker(markers, '9')}</>);
  expect(renders.mock.calls).toEqual([['9', true]]);
  renders.mockClear();
  view.rerender(<>{selectMapMarker(markers, '10')}</>);
  expect(renders.mock.calls).toEqual([['9', false], ['10', true]]);
  renders.mockClear();
  view.rerender(<>{selectMapMarker(markers, null)}</>);
  expect(renders.mock.calls).toEqual([['10', false]]);
});
