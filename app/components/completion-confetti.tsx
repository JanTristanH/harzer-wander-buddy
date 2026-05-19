import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

const COMPLETION_CONFETTI_DURATION_MS = 3400;
const COMPLETION_CONFETTI_ROW_COUNT = 8;
const COMPLETION_CONFETTI_PIECES_PER_ROW = 18;
const COMPLETION_CONFETTI_START_Y = -96;
const COMPLETION_CONFETTI_VERTICAL_SPREAD = 420;
const completionConfettiColors = ['#f5f3ee', '#d2c18f', '#8fd2a4', '#f0a15e', '#d95f5f', '#4d8f6f'];

function seededConfettiRandom(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const completionConfettiPieces = Array.from(
  { length: COMPLETION_CONFETTI_ROW_COUNT * COMPLETION_CONFETTI_PIECES_PER_ROW },
  (_, index) => {
    const rowIndex = Math.floor(index / COMPLETION_CONFETTI_PIECES_PER_ROW);
    const columnIndex = index % COMPLETION_CONFETTI_PIECES_PER_ROW;
    const rowRatio = rowIndex / Math.max(1, COMPLETION_CONFETTI_ROW_COUNT - 1);
    const xJitter = (seededConfettiRandom(index, 1) - 0.5) * 0.85;
    const xRatio = Math.max(
      0.015,
      Math.min(0.985, (columnIndex + 0.5 + xJitter) / COMPLETION_CONFETTI_PIECES_PER_ROW)
    );

    return {
      color: completionConfettiColors[(index + rowIndex) % completionConfettiColors.length],
      delayRatio: 0.02 + rowRatio * 0.1 + seededConfettiRandom(index, 2) * 0.1,
      driftX: (seededConfettiRandom(index, 3) - 0.5) * 170,
      height: seededConfettiRandom(index, 4) > 0.58 ? 15 : 9,
      rotateDeg: (seededConfettiRandom(index, 5) > 0.5 ? 1 : -1) * (360 + seededConfettiRandom(index, 6) * 900),
      size: 5 + Math.round(seededConfettiRandom(index, 7) * 7),
      startY:
        COMPLETION_CONFETTI_START_Y +
        rowRatio * COMPLETION_CONFETTI_VERTICAL_SPREAD +
        (seededConfettiRandom(index, 8) - 0.5) * 42,
      xRatio,
    };
  }
);

type CompletionConfettiProps = {
  progress: Animated.Value;
  visible: boolean;
};

export function useCompletionConfetti() {
  const [isVisible, setIsVisible] = useState(false);
  const hasPlayedRef = useRef(false);
  const isMountedRef = useRef(true);
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const play = useCallback(() => {
    if (hasPlayedRef.current) {
      return;
    }

    hasPlayedRef.current = true;
    animationRef.current?.stop();
    progress.setValue(0);
    setIsVisible(true);

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: COMPLETION_CONFETTI_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animationRef.current = animation;
    animation.start(() => {
      animationRef.current = null;
      if (isMountedRef.current) {
        setIsVisible(false);
      }
    });
  }, [progress]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      animationRef.current?.stop();
    };
  }, []);

  return { isVisible, play, progress };
}

export function CompletionConfetti({ progress, visible }: CompletionConfettiProps) {
  const windowDimensions = useWindowDimensions();

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {completionConfettiPieces.map((piece, index) => {
        const fallDistance = Math.max(windowDimensions.height + 180, 700);
        const startX = piece.xRatio * windowDimensions.width;
        const visibleAt = Math.min(0.55, piece.delayRatio + 0.08);
        const translateX = progress.interpolate({
          inputRange: [0, piece.delayRatio, 1],
          outputRange: [startX, startX, startX + piece.driftX],
        });
        const translateY = progress.interpolate({
          inputRange: [0, piece.delayRatio, 1],
          outputRange: [piece.startY, piece.startY, fallDistance + piece.startY],
        });
        const rotate = progress.interpolate({
          inputRange: [0, piece.delayRatio, 1],
          outputRange: ['0deg', '0deg', `${piece.rotateDeg}deg`],
        });
        const opacity = progress.interpolate({
          inputRange: [0, piece.delayRatio, visibleAt, 0.82, 1],
          outputRange: [0, 0, 1, 1, 0],
        });

        return (
          <Animated.View
            key={`completion-confetti-${index}`}
            style={[
              styles.piece,
              {
                width: piece.size,
                height: piece.height,
                borderRadius: piece.size / 2,
                backgroundColor: piece.color,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  piece: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
