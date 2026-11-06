import Svg, { Circle, Line } from "react-native-svg";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedProps,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  dialMinutesLabel,
  snapDialMinutes,
  TIME_DIAL_MIN,
  TIME_DIAL_MAX,
} from "@/lib/time-dial";
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const circumference = 2 * Math.PI * 104;
type Props = {
  minutes: string;
  onInteract: () => void;
  onChange: (minutes: string) => void;
};
/** A turn is an hour. Only five-minute detents cross from the UI thread to React. */
export function TimeDial({ minutes, onInteract, onChange }: Props) {
  const value = snapDialMinutes(Number(minutes) || 120);
  const raw = useSharedValue(value),
    last = useSharedValue(0),
    active = useSharedValue(false);
  useEffect(() => {
    if (!active.get()) raw.set(value);
  }, [value, raw, active]);
  const commit = (next: number) => onChange(String(next));
  useAnimatedReaction(
    () => Math.max(15, Math.min(720, Math.round(raw.get() / 5) * 5)),
    (next, previous) => {
      if (active.get() && next !== previous) scheduleOnRN(commit, next);
    },
  );
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      active.set(Math.hypot(event.x - 107, event.y - 107) >= 65);
      last.set((Math.atan2(event.x - 107, 107 - event.y) * 180) / Math.PI);
      if (active.get()) scheduleOnRN(onInteract);
    })
    .onUpdate((event) => {
      if (!active.get()) return;
      const next = (Math.atan2(event.x - 107, 107 - event.y) * 180) / Math.PI;
      const delta = ((next - last.get() + 540) % 360) - 180;
      raw.set(Math.max(15, Math.min(720, raw.get() + delta / 6)));
      last.set(next);
    })
    .onFinalize(() => {
      active.set(false);
      raw.set(Math.max(15, Math.min(720, Math.round(raw.get() / 5) * 5)));
      scheduleOnRN(
        commit,
        Math.max(15, Math.min(720, Math.round(raw.get() / 5) * 5)),
      );
    });
  const ring = useAnimatedProps(() => {
    const remainder = raw.get() % 60;
    return {
      strokeDashoffset:
        circumference * (1 - (remainder === 0 ? 1 : remainder / 60)),
    };
  });
  const rotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${raw.get() * 6}deg` }],
  }));
  const counter = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-raw.get() * 6}deg` }],
  }));
  return (
    <GestureDetector gesture={pan}>
      <View
        testID="time-dial"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Zeitbudget durch Drehen einstellen"
        accessibilityValue={{
          min: TIME_DIAL_MIN,
          max: TIME_DIAL_MAX,
          now: value,
          text: dialMinutesLabel(value),
        }}
        accessibilityActions={[
          { name: "increment", label: "5 Minuten mehr" },
          { name: "decrement", label: "5 Minuten weniger" },
        ]}
        onAccessibilityAction={(event) => {
          onInteract();
          onChange(
            String(
              snapDialMinutes(
                value + (event.nativeEvent.actionName === "increment" ? 5 : -5),
              ),
            ),
          );
        }}
        style={{
          width: 214,
          height: 214,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={214}
          height={214}
          viewBox="0 0 214 214"
          pointerEvents="none"
          style={{ position: "absolute", inset: 0 }}
        >
          <Circle
            cx={107}
            cy={107}
            r={104}
            fill="none"
            stroke="#c7d2c3"
            strokeWidth={5}
          />
          <AnimatedCircle
            cx={107}
            cy={107}
            r={104}
            fill="none"
            stroke="#2e6b4b"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={[circumference, circumference]}
            rotation={-90}
            origin="107,107"
            animatedProps={ring}
          />
          {Array.from({ length: 12 }, (_, index) => (
            <Line
              key={index}
              x1={107}
              y1={16}
              x2={107}
              y2={index % 3 === 0 ? 24 : 20}
              stroke="#a4b5a0"
              strokeWidth={index % 3 === 0 ? 2 : 1}
              rotation={index * 30}
              origin="107,107"
            />
          ))}
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", inset: 0 }, rotation]}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                top: -19,
                left: 85,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#2e6b4b",
                alignItems: "center",
                justifyContent: "center",
              },
              counter,
            ]}
          >
            <MaterialIcons name="hiking" size={27} color="#fff" />
          </Animated.View>
        </Animated.View>
        <Text
          style={{
            fontSize: value % 60 ? 27 : 36,
            fontWeight: "700",
            color: "#1e2a1e",
          }}
        >
          {dialMinutesLabel(value)}
        </Text>
        <Text style={{ marginTop: 7, fontSize: 12, color: "#596553" }}>
          Drehen für eigene Zeit
        </Text>
      </View>
    </GestureDetector>
  );
}
