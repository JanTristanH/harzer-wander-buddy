import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { HikingRouteResult, PointOfInterest } from "@/lib/api";
import { TourRouteMap, PlannerButton } from "@/components/tour-planner-ui";
import {
  formatTourDistance,
  formatTourDuration,
  routeName,
  routeStops,
} from "@/lib/tour-automation";
type Props = {
  route: HikingRouteResult;
  points: PointOfInterest[];
  title?: string;
  index?: number;
  total?: number;
  onSelect?: (index: number) => void;
  primaryLabel: string;
  onPrimary: () => void;
  busy?: boolean;
  disabled?: boolean;
  error?: string;
  notification?: string;
  onParameters?: () => void;
  description?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
};
export function TourExperience({
  route,
  points,
  title,
  index = 0,
  total = 1,
  onSelect,
  primaryLabel,
  onPrimary,
  busy,
  disabled,
  error,
  notification,
  onParameters,
  secondaryLabel,
  onSecondary,
  description,
}: Props) {
  const router = useRouter();
  const [height, setHeight] = useState(700),
    [visible, setVisible] = useState(350),
    [summary, setSummary] = useState(160),
    [footer, setFooter] = useState(115);
  const maximum = Math.max(240, height - 24),
    peek = Math.min(Math.max(290, summary + footer + 12), maximum),
    middle = Math.max(peek, Math.min(390, height * 0.55));
  const y = useSharedValue(maximum - middle),
    start = useSharedValue(0);
  useEffect(() => {
    setVisible(middle);
    y.set(maximum - middle);
  }, [middle, maximum, y]);
  const settle = (next: number) => setVisible(maximum - next);
  const move = (next: number) => {
    y.set(
      withSpring(next, {
        duration: 300,
        dampingRatio: 0.8,
        overshootClamping: true,
        reduceMotion: ReduceMotion.System,
      }),
    );
    setVisible(maximum - next);
  };
  const gesture = Gesture.Pan()
    .onBegin(() => {
      start.set(y.get());
    })
    .onUpdate((event) => {
      y.set(
        Math.max(0, Math.min(maximum - peek, start.get() + event.translationY)),
      );
    })
    .onEnd((event) => {
      const projected = y.get() + event.velocityY * 0.12;
      const targets = [0, maximum - middle, maximum - peek];
      let target = targets[0];
      for (const candidate of targets)
        if (Math.abs(candidate - projected) < Math.abs(target - projected))
          target = candidate;
      y.set(
        withSpring(target, {
          duration: 300,
          dampingRatio: 0.8,
          velocity: event.velocityY,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
        }),
      );
      scheduleOnRN(settle, target);
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
  }));
  const stops = routeStops(route, points);
  return (
    <View
      testID="tour-map-sheet"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={{ flex: 1, overflow: "hidden" }}
    >
      <View style={StyleSheet.absoluteFill}>
        <TourRouteMap key={route.id} route={route} points={points} fullHeight />
      </View>
      <Animated.View
        testID="tour-bottom-sheet"
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: maximum,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: "#fff",
            elevation: 10,
          },
          style,
        ]}
      >
        <View onLayout={(event) => setSummary(event.nativeEvent.layout.height)}>
          <GestureDetector gesture={gesture}>
            <Animated.View>
              <Pressable
                testID="tour-sheet-handle"
                accessibilityRole="adjustable"
                accessibilityLabel="Höhe der Touren-Details"
                accessibilityValue={{
                  min: Math.round(peek),
                  max: Math.round(maximum),
                  now: Math.round(visible),
                }}
                accessibilityActions={[
                  { name: "increment", label: "Details aufklappen" },
                  { name: "decrement", label: "Karte anzeigen" },
                ]}
                onAccessibilityAction={(event) =>
                  move(
                    event.nativeEvent.actionName === "increment"
                      ? 0
                      : maximum - peek,
                  )
                }
                onPress={() =>
                  move(visible < maximum - 30 ? 0 : maximum - middle)
                }
                style={{
                  minHeight: 48,
                  padding: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 4,
                    borderRadius: 4,
                    backgroundColor: "#c7d2c3",
                    marginBottom: 8,
                  }}
                />
                <Text style={{ fontSize: 12, color: "#596553" }}>
                  Tour & Stationen
                </Text>
              </Pressable>
            </Animated.View>
          </GestureDetector>
          <View style={{ paddingHorizontal: 22 }}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 22, fontWeight: "700", color: "#1e2a1e" }}
              numberOfLines={2}
            >
              {title || routeName(route, points, index)}
            </Text>
            <Text style={{ fontSize: 16, color: "#42563e", marginVertical: 8 }}>
              {formatTourDuration(route.duration)} ·{" "}
              {formatTourDistance(route.distance)}
            </Text>
            {onSelect && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderWidth: 1,
                  borderColor: "#d7dfd3",
                  borderRadius: 14,
                  marginBottom: 8,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Vorheriger Vorschlag"
                  disabled={index === 0}
                  onPress={() => onSelect(index - 1)}
                  style={{ padding: 12, opacity: index === 0 ? 0.3 : 1 }}
                >
                  <Text>‹</Text>
                </Pressable>
                <Text accessibilityLiveRegion="polite">
                  {index + 1} / {total} Vorschläge
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Nächster Vorschlag"
                  disabled={index === total - 1}
                  onPress={() => onSelect(index + 1)}
                  style={{
                    padding: 12,
                    opacity: index === total - 1 ? 0.3 : 1,
                  }}
                >
                  <Text>›</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
        <ScrollView
          key={route.id}
          style={{
            height: Math.max(0, visible - summary - footer),
            flexGrow: 0,
          }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20 }}
        >
          <Text style={{ color: "#596553", marginVertical: 12 }}>
            ↑ {Math.round(route.totalElevationGain ?? 0)} m · ↓{" "}
            {Math.round(route.totalElevationLoss ?? 0)} m ·{" "}
            {route.stampCount ?? 0} Stempel
          </Text>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 17, fontWeight: "700", marginVertical: 12 }}
          >
            Stationen
          </Text>
          {stops.map((point, i) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${i === 0 ? "Start" : i === stops.length - 1 ? "Ziel" : `Station ${i}`}: ${point.name} öffnen`}
              onPress={() =>
                router.push(
                  `/${point.poiType === "parking" ? "parking" : "stamps"}/${encodeURIComponent(point.ID)}` as never,
                )
              }
              key={`${point.ID}-${i}`}
              style={{
                flexDirection: "row",
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderColor: "#d7dfd3",
              }}
            >
              <Text
                style={{ color: "#2e6b4b", fontWeight: "700", minWidth: 32 }}
              >
                {point.poiType === "parking"
                  ? "P"
                  : `#${point.stampNumber || "·"}`}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: "#1e2a1e" }}>
                  {point.name}
                </Text>
                <Text style={{ fontSize: 11, color: "#596553", marginTop: 4 }}>
                  {i === 0
                    ? "Start"
                    : i === stops.length - 1
                      ? point.ID === stops[0]?.ID
                        ? "Ziel / Rückkehr"
                        : "Ziel"
                      : `Stopp ${i}`}
                </Text>
              </View>
            </Pressable>
          ))}
          {!stops.length && (
            <Text>
              Diese Tour hat noch keine Stationen. Im Editor kannst du Start und
              Ziel hinzufügen.
            </Text>
          )}
          {description && (
            <Text style={{ marginTop: 12, color: "#596553" }}>
              {description}
            </Text>
          )}
          {(route.groupSize ?? 1) > 1 && (
            <Text style={{ marginTop: 12, color: "#596553" }}>
              {route.newStampCountForUser ?? 0} neue Stempel für dich ·{" "}
              {route.groupSize} Personen
            </Text>
          )}
        </ScrollView>
      </Animated.View>
      <View
        onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 22,
          paddingVertical: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: "#edf0e9",
          backgroundColor: "#fff",
          gap: 6,
        }}
      >
        {notification && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: "#2e6b4b", fontSize: 12 }}
          >
            {notification}
          </Text>
        )}
        {error && (
          <Text accessibilityRole="alert" style={{ color: "#ac3427" }}>
            {error}
          </Text>
        )}
        <PlannerButton
          title={primaryLabel}
          onPress={onPrimary}
          disabled={disabled || busy}
          loading={busy}
        />
        {onSecondary && (
          <Pressable
            accessibilityRole="button"
            onPress={onSecondary}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#2e6b4b" }}>{secondaryLabel}</Text>
          </Pressable>
        )}
        {onParameters && (
          <Pressable
            accessibilityRole="button"
            onPress={onParameters}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#2e6b4b" }}>Parameter ändern</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
