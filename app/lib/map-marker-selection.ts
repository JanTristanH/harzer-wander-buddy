import React from 'react';
import selectedMapPin from './selected-map-pin.json';

export const SELECTED_MARKER_Z_INDEX = 1000000;
export const SELECTED_MAP_PIN = selectedMapPin;

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
