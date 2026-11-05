import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing, interpolate, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';

import {
  STAMP_FLIGHT_MS, STAMP_SEAL_ENTER_MS, STAMP_SEAL_EXIT_MS, stampSelectionTiming,
} from '@/lib/stamp-selection-motion';

const successBuddyBadge = require('@/assets/images/buddy/stamp-success-badge.png');
const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

/** An absolute, childless fill leaves the button label and touch bounds unchanged. */
export function StampSelectionFill({ progress }: { progress: number }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: 1100, easing: easeOut }));
  }, [fill, progress]);
  const style = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return <Reanimated.View pointerEvents="none" style={[styles.fill, style]} testID="stamp-action-fill" />;
}

function FlyingStamp({ index, count, elapsed }: { index: number; count: number; elapsed: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const laneCount = Math.min(count, 3);
  const startX = ((index % laneCount) - (laneCount - 1) / 2) * 88;
  const delay = count > 1 ? stampSelectionTiming(count).staggerWindowMs * index / (count - 1) : 0;
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (elapsed.get() - delay) / STAMP_FLIGHT_MS));
    return {
      opacity: reduced || elapsed.get() < delay ? 0 : interpolate(t, [0, 0.8, 1], [1, 1, 0]),
      transform: [
        { translateX: reduced ? 0 : startX * (1 - t) },
        { translateY: reduced ? 0 : 110 * (1 - t) },
      ],
    };
  });
  return <Reanimated.View testID="stamp-flying-visit" style={[styles.flyingStamp, style]}><Feather name="check" size={24} color="#2e6b4b" /></Reanimated.View>;
}

function ConfettiPiece({ index, elapsed, start, duration }: { index: number; elapsed: SharedValue<number>; start: number; duration: number }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (elapsed.get() - start) / duration));
    return {
      opacity: reduced ? 0 : (t > 0 ? 1 - t : 0),
      transform: [
        { translateX: Math.cos(index * 2.4) * 115 * t },
        { translateY: Math.sin(index * 2.4) * 65 * t + 45 * t * t },
        { rotate: `${index * 25 + t * 120}deg` },
      ],
    };
  });
  return <Reanimated.View style={[styles.confetti, { backgroundColor: ['#d2c18f', '#8fd2a4', '#f5f3ee'][index % 3] }, style]} />;
}

/** Only mounted after all requested visits have been acknowledged by the backend. */
export function StampSelectionCelebration({ count, onFinish }: { count: number; onFinish: () => void }) {
  const reduced = useReducedMotion();
  const elapsed = useSharedValue(0);
  const { sealStartMs, durationMs } = stampSelectionTiming(count);
  useEffect(() => {
    elapsed.set(withTiming(durationMs, { duration: reduced ? 200 : durationMs, easing: Easing.linear }));
    const timer = setTimeout(onFinish, reduced ? 900 : durationMs + 150);
    return () => clearTimeout(timer);
  }, [durationMs, elapsed, onFinish, reduced]);
  const seal = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : interpolate(elapsed.get(), [0, sealStartMs, sealStartMs + STAMP_SEAL_ENTER_MS, durationMs - STAMP_SEAL_EXIT_MS, durationMs], [0, 0, 1, 1, 0]),
    transform: [
      { scale: reduced ? 1 : interpolate(elapsed.get(), [0, sealStartMs, sealStartMs + STAMP_SEAL_ENTER_MS, durationMs], [1.08, 1.08, 1, 1]) },
      { rotate: reduced ? '0deg' : '-8deg' },
    ],
  }));
  return (
    <View pointerEvents="none" style={styles.celebration} testID="stamp-selection-celebration" accessible={false} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => <FlyingStamp key={index} index={index} count={count} elapsed={elapsed} />)}
      <Reanimated.View style={[styles.seal, seal]}>
        <Image source={successBuddyBadge} contentFit="contain" accessible={false} style={styles.successBadge} testID="stamp-success-buddy-badge" />
        <View style={styles.sealText}>
          <Text style={styles.sealTitle}>Ein Stück weiter!</Text>
          <Text style={styles.sealCopy}>{count} {count === 1 ? 'Besuch' : 'Besuche'} gestempelt</Text>
        </View>
      </Reanimated.View>
      {Array.from({ length: 18 }, (_, index) => <ConfettiPiece key={index} index={index} elapsed={elapsed} start={sealStartMs} duration={durationMs - sealStartMs} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#66934d' },
  celebration: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  flyingStamp: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: '#dfe9cc', alignItems: 'center', justifyContent: 'center' },
  seal: { padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#2e6b4b', backgroundColor: '#edf5ee', flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  successBadge: { width: 104, height: 104 },
  sealText: { flexShrink: 1, gap: 4 },
  sealTitle: { color: '#2e6b4b', fontSize: 18, fontWeight: '700' },
  sealCopy: { color: '#42664d', fontSize: 12 },
  confetti: { position: 'absolute', width: 5, height: 9, borderRadius: 1 },
});
