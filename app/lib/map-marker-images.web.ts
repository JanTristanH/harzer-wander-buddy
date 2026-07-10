import { type ImageRequireSource } from 'react-native';

type MarkerVisualKind = 'visited-stamp' | 'open-stamp' | 'parking' | 'parking-order' | 'tour-order';

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
