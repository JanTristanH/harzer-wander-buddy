import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';

const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

/** An absolute, childless fill leaves the button label and touch bounds unchanged. */
export function StampSelectionFill({ progress }: { progress: number }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: 220, easing: easeOut }));
  }, [fill, progress]);
  const style = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return <Reanimated.View pointerEvents="none" style={[styles.fill, style]} testID="stamp-action-fill" />;
}

function ConfettiPiece({ index, progress }: { index: number; progress: ReturnType<typeof useSharedValue<number>> }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, (progress.get() - 0.45) / 0.55);
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
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: reduced ? 200 : 1250, easing: Easing.linear }));
    const timer = setTimeout(onFinish, reduced ? 450 : 1400);
    return () => clearTimeout(timer);
  }, [onFinish, progress, reduced]);
  const flight = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : interpolate(progress.get(), [0, 0.3, 0.45, 1], [1, 1, 0, 0]),
    transform: [{ translateY: reduced ? 0 : interpolate(progress.get(), [0, 0.45, 1], [110, 0, 0]) }],
  }));
  const seal = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : interpolate(progress.get(), [0, 0.45, 0.6, 0.9, 1], [0, 0, 1, 1, 0]),
    transform: [
      { scale: reduced ? 1 : interpolate(progress.get(), [0, 0.45, 0.6, 1], [1.12, 1.12, 1, 1]) },
      { rotate: reduced ? '0deg' : '-8deg' },
    ],
  }));
  return (
    <View pointerEvents="none" style={styles.celebration} testID="stamp-selection-celebration" accessible={false} importantForAccessibility="no-hide-descendants">
      <Reanimated.View style={[styles.flyingStamp, flight]}><Feather name="check" size={24} color="#2e6b4b" /></Reanimated.View>
      <Reanimated.View style={[styles.seal, seal]}>
        <Feather name="check-circle" size={30} color="#2e6b4b" />
        <Text style={styles.sealTitle}>Ein Stück weiter!</Text>
        <Text style={styles.sealCopy}>{count} {count === 1 ? 'Besuch' : 'Besuche'} gestempelt</Text>
      </Reanimated.View>
      {Array.from({ length: 18 }, (_, index) => <ConfettiPiece key={index} index={index} progress={progress} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#66934d' },
  celebration: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  flyingStamp: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: '#dfe9cc', alignItems: 'center', justifyContent: 'center' },
  seal: { padding: 14, borderRadius: 20, borderWidth: 2, borderColor: '#2e6b4b', backgroundColor: '#edf5ee', alignItems: 'center', gap: 4 },
  sealTitle: { color: '#2e6b4b', fontSize: 18, fontWeight: '700' },
  sealCopy: { color: '#42664d', fontSize: 12 },
  confetti: { position: 'absolute', width: 5, height: 9, borderRadius: 1 },
});
