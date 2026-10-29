import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
export function BuddyLoading() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return (
    <Modal visible animationType="fade" onRequestClose={() => {}}>
      <View
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy: true }}
        style={{
          flex: 1,
          backgroundColor: "#f5f3ee",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 14,
        }}
      >
        <Image
          source={
            reduced
              ? require("@/assets/images/buddy/map-poster.png")
              : require("@/assets/images/buddy/map-loop.webp")
          }
          accessibilityLabel="Buddy schaut in seine Wanderkarte"
          style={{ width: 210, height: 280 }}
          contentFit="contain"
        />
        <Text
          accessibilityRole="header"
          style={{ fontSize: 22, fontWeight: "700", color: "#1e2a1e" }}
        >
          Buddy plant deine Runde …
        </Text>
        <Text style={{ fontSize: 14, color: "#596553", textAlign: "center" }}>
          Wege, Stempel und Rückweg werden geprüft.
        </Text>
        <ActivityIndicator color="#2e6b4b" />
      </View>
    </Modal>
  );
}
