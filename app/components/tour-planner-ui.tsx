import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  type MapViewRef,
} from '@/components/maps/map-primitives';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { HikingRouteResult, PointOfInterest } from '@/lib/api';
import {
  formatTourDistance,
  formatTourDuration,
  parseRouteCoordinates,
  routeName,
  routeStops,
} from '@/lib/tour-automation';

export function usePlannerColors() {
  return useColorScheme() === 'dark'
    ? {
        background: '#172019',
        surface: '#222e25',
        text: '#edf2ea',
        secondary: '#b5c3b5',
        accent: '#a2d1ad',
        button: '#2e6b4b',
        soft: '#2c3e30',
        border: '#596b5a',
      }
    : {
        background: '#f5f3ee',
        surface: '#ffffff',
        text: '#1e2a1e',
        secondary: '#596553',
        accent: '#2e6b4b',
        button: '#2e6b4b',
        soft: '#e6eee4',
        border: '#c7d2c3',
      };
}

export function PlannerButton({
  title,
  onPress,
  disabled,
  secondary,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  const colors = usePlannerColors();
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={Boolean(disabled)}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        ui.button,
        { backgroundColor: secondary ? colors.soft : colors.button },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
      ]}>
      <Text
        style={[
          ui.buttonText,
          { color: secondary ? colors.accent : '#ffffff' },
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function PlannerStepper({
  step,
  onStepPress,
}: {
  step: number;
  onStepPress?: (step: number) => void;
}) {
  const colors = usePlannerColors();
  return (
    <View style={ui.stepper} accessibilityLabel={`Schritt ${step} von 3`}>
      {['Zeit & Start', 'Für wen', 'Vorschläge'].map((label, index) => {
        const number = index + 1,
          complete = number < step,
          active = number === step;
        return (
          <React.Fragment key={label}>
            {index > 0 ? (
              <View
                style={[
                  ui.connector,
                  {
                    backgroundColor:
                      number <= step ? colors.accent : colors.border,
                  },
                ]}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${complete ? 'abgeschlossen' : active ? 'aktueller Schritt' : 'noch offen'}`}
              aria-selected={active}
              accessibilityState={{
                selected: active,
                disabled: !complete || !onStepPress,
              }}
              disabled={!complete || !onStepPress}
              onPress={() => onStepPress?.(number)}
              style={ui.step}>
              <View
                style={[
                  ui.stepDot,
                  {
                    borderColor:
                      active || complete ? colors.accent : colors.border,
                    backgroundColor: complete ? colors.accent : 'transparent',
                  },
                ]}>
                {complete ? (
                  <Feather name="check" size={15} color={colors.background} />
                ) : active ? (
                  <View
                    style={[ui.dotCenter, { backgroundColor: colors.accent }]}
                  />
                ) : null}
              </View>
              <Text
                style={[
                  ui.stepLabel,
                  {
                    color: active || complete ? colors.text : colors.secondary,
                    fontWeight: active ? '700' : '400',
                  },
                ]}>
                {label}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function TourThumbnail({
  svg,
  size = 100,
}: {
  svg?: string;
  size?: number;
}) {
  return svg ? (
    <Image
      source={{
        uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      }}
      contentFit="contain"
      accessibilityLabel="Vorschau des tatsächlichen Routenverlaufs"
      style={{ width: size, height: size, borderRadius: 14 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: '#e6eee4',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Feather name="map" color="#2e6b4b" size={28} />
    </View>
  );
}

export function TourRouteMap({
  route,
  points,
  animate = true,
  compact = false,
}: {
  route: HikingRouteResult;
  points: PointOfInterest[];
  animate?: boolean;
  compact?: boolean;
}) {
  const ref = useRef<MapViewRef | null>(null);
  const { height } = useWindowDimensions();
  const segments = useMemo(
    () =>
      route.path
        .map((link) => ({
          coordinates: parseRouteCoordinates(link.travelTime?.positionString),
          drive: link.travelTime?.travelMode === 'drive',
        }))
        .filter((segment) => segment.coordinates.length > 1),
    [route.path]
  );
  const coordinates = useMemo(
    () => segments.flatMap((segment) => segment.coordinates),
    [segments]
  );
  const stops = useMemo(
    () => [
      ...new Map(
        routeStops(route, points).map((point) => [point.ID, point])
      ).values(),
    ],
    [points, route]
  );
  const [ready, setReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [fraction, setFraction] = useState(1);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (!ready || reduceMotion || !animate) {
      setFraction(1);
      return;
    }
    progress.setValue(0);
    const listener = progress.addListener(({ value }) => setFraction(value));
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 650,
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      progress.removeListener(listener);
    };
  }, [animate, progress, ready, reduceMotion]);
  if (!coordinates.length)
    return (
      <View style={ui.noMap}>
        <Feather name="map" size={36} color="#2e6b4b" />
        <Text>Kartenverlauf nicht verfügbar</Text>
      </View>
    );
  const fit = () => {
    ref.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 40, right: 40, bottom: 45, left: 40 },
      animated: false,
    });
    setReady(true);
  };
  const latitudes = coordinates.map((point) => point.latitude),
    longitudes = coordinates.map((point) => point.longitude);
  const minLat = Math.min(...latitudes),
    maxLat = Math.max(...latitudes),
    minLng = Math.min(...longitudes),
    maxLng = Math.max(...longitudes);
  let offset = 0;
  return (
    <View
      style={[
        ui.map,
        compact && { height: Math.max(200, Math.min(270, height * 0.28)) },
      ]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: Math.max(0.008, (maxLat - minLat) * 1.4),
          longitudeDelta: Math.max(0.008, (maxLng - minLng) * 1.4),
        }}
        onMapReady={fit}>
        {segments.map((segment, index) => {
          const visibleCount = Math.max(
            0,
            Math.ceil(coordinates.length * fraction) - offset
          );
          offset += segment.coordinates.length;
          return (
            <Polyline
              key={index}
              coordinates={segment.coordinates.slice(0, visibleCount)}
              strokeColor={segment.drive ? '#897449' : '#2e6b4b'}
              strokeWidth={5}
            />
          );
        })}
        {stops
          .filter(
            (point) =>
              point.latitude !== undefined && point.longitude !== undefined
          )
          .map((point, index) => (
            <Marker
              key={point.ID}
              pinColor="#2e6b4b"
              coordinate={{
                latitude: point.latitude!,
                longitude: point.longitude!,
              }}
              accessibilityLabel={point.name}>
              <View style={ui.marker}>
                <Text style={ui.markerText}>
                  {point.poiType === 'parking'
                    ? 'P'
                    : point.stampNumber || index}
                </Text>
              </View>
            </Marker>
          ))}
      </MapView>
      <Pressable
        onPress={fit}
        accessibilityRole="button"
        accessibilityLabel="Ganze Route anzeigen"
        style={ui.fitButton}>
        <Feather name="maximize" size={20} color="#2e6b4b" />
      </Pressable>
    </View>
  );
}

export function TourProposal({
  route,
  points,
  index,
  total,
  groupMode,
  onSelect,
  onDetail,
}: {
  route: HikingRouteResult;
  points: PointOfInterest[];
  index: number;
  total: number;
  groupMode?: 'missing_all' | 'missing_any';
  onSelect?: (index: number) => void;
  onDetail?: () => void;
}) {
  const colors = usePlannerColors();
  const solo = (route.groupSize ?? 1) <= 1;
  return (
    <View>
      <TourRouteMap
        key={route.id}
        route={route}
        points={points}
        compact={Boolean(onDetail)}
      />
      <View style={[ui.proposal, { backgroundColor: colors.surface }]}>
        <View style={ui.grabber} />
        <Text
          style={[
            ui.badge,
            { color: colors.accent, backgroundColor: colors.soft },
          ]}>
          {`${route.matchingStampCount} ${solo ? 'neue' : 'passende'} Stempel${solo ? ' für dich' : ''}`}
        </Text>
        <Text style={[ui.title, { color: colors.text }]}>
          {routeName(route, points, index)}
        </Text>
        <Text
          style={[
            ui.metrics,
            { color: colors.text },
          ]}>{`${formatTourDuration(route.duration)} · ${formatTourDistance(route.distance)}`}</Text>
        <Text
          style={[
            ui.body,
            { color: colors.secondary },
          ]}>{`↑ ${Math.round(route.totalElevationGain ?? 0)} m · ↓ ${Math.round(route.totalElevationLoss ?? 0)} m · ${route.stampCount ?? 0} Stempel insgesamt`}</Text>
        {!solo ? (
          <Text
            style={[
              ui.body,
              { color: colors.secondary },
            ]}>{`Für dich ${route.newStampCountForUser ?? 0} neue Stempel · ${groupMode === 'missing_all' ? 'Passende Stempel fehlen allen.' : 'Passende Stempel fehlen mindestens einer Person.'}`}</Text>
        ) : null}
        {onSelect ? (
          <View style={[ui.pager, { borderColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vorheriger Vorschlag"
              disabled={index === 0}
              onPress={() => onSelect(index - 1)}
              style={[ui.iconButton, index === 0 && ui.disabled]}>
              <Feather name="chevron-left" color={colors.accent} size={22} />
            </Pressable>
            <Text
              accessibilityLiveRegion="polite"
              style={[
                ui.body,
                { color: colors.text },
              ]}>{`${index + 1} / ${total} Vorschläge`}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nächster Vorschlag"
              disabled={index === total - 1}
              onPress={() => onSelect(index + 1)}
              style={[ui.iconButton, index === total - 1 && ui.disabled]}>
              <Feather name="chevron-right" color={colors.accent} size={22} />
            </Pressable>
          </View>
        ) : null}
        {onDetail ? (
          <PlannerButton
            title="Details und Stationen ansehen"
            secondary
            onPress={onDetail}
          />
        ) : null}
      </View>
    </View>
  );
}

export const ui = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  disabled: { opacity: 0.35 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  step: { alignItems: 'center', gap: 8, minHeight: 55, flex: 1 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCenter: { width: 14, height: 14, borderRadius: 7 },
  stepLabel: { fontSize: 12, textAlign: 'center' },
  connector: { height: 1, flex: 0.35, marginTop: 13, marginHorizontal: -12 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  body: { fontSize: 15, lineHeight: 22 },
  metrics: { fontSize: 17, lineHeight: 26 },
  map: { height: 310, backgroundColor: '#dfe7d8', overflow: 'hidden' },
  noMap: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#e6eee4',
  },
  fitButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#2e6b4b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  markerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  proposal: { marginTop: -16, borderRadius: 24, padding: 20, gap: 12 },
  grabber: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c7d2c3',
    alignSelf: 'center',
    marginTop: -9,
    marginBottom: 2,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderRadius: 12,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 15,
    borderWidth: 1,
  },
});
