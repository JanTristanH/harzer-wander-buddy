import { Platform } from 'react-native';

type MapPrimitivesModule = Pick<
  typeof import('./map-primitives.native'),
  'default' | 'Marker' | 'Polyline'
>;

const mapPrimitives =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? (require('./map-primitives.web') as MapPrimitivesModule)
    : (require('./map-primitives.native') as MapPrimitivesModule);

const MapView = mapPrimitives.default;
const Marker = mapPrimitives.Marker;
const Polyline = mapPrimitives.Polyline;

export default MapView;
export { Marker, Polyline };
export type { Camera, LatLng, MapViewRef, Region } from './map-primitives.native';
