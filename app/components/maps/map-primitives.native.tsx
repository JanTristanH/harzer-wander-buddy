import MapView, {
  Marker as NativeMarker,
  Polyline,
  type Camera,
  type LatLng,
  type Region,
} from "react-native-maps";
import React from "react";
import { Image, Text, View } from "react-native";

export type { Camera, LatLng, Region };

export type MapViewRef = MapView;
type NativeMapViewProps = React.ComponentProps<typeof MapView> & {
  attributionPlacement?: "bottom-right" | "below-zoom";
};

const NativeMapView = React.forwardRef<MapView, NativeMapViewProps>(
  function NativeMapView(
    { attributionPlacement: _attributionPlacement, ...props },
    ref,
  ) {
    return <MapView ref={ref} {...props} />;
  },
);

function Marker({
  noticeBadge,
  image,
  children,
  ...props
}: React.ComponentProps<typeof NativeMarker> & { noticeBadge?: boolean }) {
  const markerRef = React.useRef<React.ComponentRef<typeof NativeMarker>>(null);
  if (!noticeBadge)
    return (
      <NativeMarker {...props} image={image}>
        {children}
      </NativeMarker>
    );
  return (
    <NativeMarker ref={markerRef} {...props}>
      <View collapsable={false} style={{ width: 48, height: 52 }}>
        {image ? (
          <Image
            onLoad={() => markerRef.current?.redraw()}
            source={image}
            style={{ width: 48, height: 52 }}
          />
        ) : (
          children
        )}
        <Text
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            borderRadius: 9,
            backgroundColor: "#ffe19a",
            color: "#713b09",
            fontSize: 13,
            paddingHorizontal: 3,
          }}
        >
          ⚡
        </Text>
      </View>
    </NativeMarker>
  );
}

export default NativeMapView;
export { Marker, Polyline };
