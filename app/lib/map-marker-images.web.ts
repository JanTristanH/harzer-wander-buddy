import { type ImageRequireSource } from 'react-native';

type MarkerVisualKind =
  | 'visited-stamp'
  | 'open-stamp'
  | 'group-open-stamp'
  | 'group-partial-stamp'
  | 'parking'
  | 'parking-order'
  | 'tour-order' | 'special-open-stamp' | 'special-visited-stamp'
  | 'special-group-open-stamp' | 'special-group-partial-stamp';

export function getPreGeneratedMapMarkerImageSource(_input: {
  kind: MarkerVisualKind;
  label: string;
}): ImageRequireSource | undefined {
  return undefined;
}

export function getPreGeneratedMapMarkerFallbackImageSource(
  _kind: MarkerVisualKind = 'open-stamp'
): ImageRequireSource | undefined {
  return undefined;
}
