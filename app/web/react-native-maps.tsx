import React from 'react';
import { View, type ViewProps } from 'react-native';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Region = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapPressEvent = {
  nativeEvent: {
    coordinate: LatLng;
  };
};

type MapViewProps = ViewProps & {
  children?: React.ReactNode;
};

const MapView = React.forwardRef<View, MapViewProps>(function MapView(props, ref) {
  return <View ref={ref} {...props} />;
});

export const Marker = React.forwardRef<View, ViewProps>(function Marker(props, ref) {
  return <View ref={ref} {...props} />;
});

export const Polyline = React.forwardRef<View, ViewProps>(function Polyline(props, ref) {
  return <View ref={ref} {...props} />;
});

export default MapView;
