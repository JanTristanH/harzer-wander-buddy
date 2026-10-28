import React from 'react';

export const SELECTED_MARKER_Z_INDEX = 1000000;
export const MARKER_SELECTION_COLOR = '#ffb300';

/** Preserve element identity for every marker except the selected one. */
export function selectMapMarker<T extends { identifier?: string; selected?: boolean }>(
  markers: React.ReactElement<T>[],
  selectedId: string | null
): React.ReactElement<T>[] {
  return markers.map(marker => marker.props.identifier === selectedId
    ? React.cloneElement(marker, { selected: true } as Partial<T>)
    : marker);
}
