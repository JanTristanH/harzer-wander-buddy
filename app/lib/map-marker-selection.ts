import React from 'react';

export const SELECTED_MARKER_Z_INDEX = 1000000;
export const SELECTED_MAP_PIN = {
  width: 48,
  height: 52,
  color: '#ea4335',
  dotColor: '#a50e0e',
  path: 'M24 51C22 44 7 32 7 19a17 17 0 1 1 34 0c0 13-15 25-17 32Z',
  dotX: 24,
  dotY: 19,
  dotRadius: 6,
};

export function createSelectedMapPinHtml() {
  const pin = SELECTED_MAP_PIN;
  return `<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 ${pin.width} ${pin.height}"><path fill="${pin.color}" d="${pin.path}"/><circle fill="${pin.dotColor}" cx="${pin.dotX}" cy="${pin.dotY}" r="${pin.dotRadius}"/></svg>`;
}

/** Preserve element identity for every marker except the selected one. */
export function selectMapMarker<T extends { identifier?: string; selected?: boolean }>(
  markers: React.ReactElement<T>[],
  selectedId: string | null
): React.ReactElement<T>[] {
  return markers.map(marker => marker.props.identifier === selectedId
    ? React.cloneElement(marker, { selected: true } as Partial<T>)
    : marker);
}
