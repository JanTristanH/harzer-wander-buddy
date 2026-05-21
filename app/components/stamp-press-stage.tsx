import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { AnimatedStamp, ANIMATED_STAMP_WIDTH } from '@/components/animated-stamp';

const STAMP_ANIMATION_SPEED = 1.5;
const STAMP_DROP_IN_MS = STAMP_ANIMATION_SPEED * 460;
const STAMP_IMPACT_MS = STAMP_ANIMATION_SPEED * 120;
const STAMP_BUTTON_PRESS_DELAY_MS = STAMP_ANIMATION_SPEED * 340;
const STAMP_BUTTON_PRESS_MS = STAMP_ANIMATION_SPEED * 300;
const STAMP_RELEASE_SETTLE_MS = STAMP_ANIMATION_SPEED * 160;
const STAMP_PEEL_MS = STAMP_ANIMATION_SPEED * 180;
const STAMP_EXIT_MS = STAMP_ANIMATION_SPEED * 420;
const STAMP_BUTTON_RELEASE_HOLD_MS = STAMP_ANIMATION_SPEED * 70;
const STAMP_BUTTON_RELEASE_MS = STAMP_ANIMATION_SPEED * 260;
const STAMP_FADE_OUT_DELAY_MS = STAMP_ANIMATION_SPEED * 560;
const STAMP_FADE_OUT_MS = STAMP_ANIMATION_SPEED * 120;

type StampPressStageRenderProps = {
  buttonAnimatedStyle: React.ComponentProps<typeof Animated.View>['style'];
  isTouchActive: boolean;
  onPressIn: (event: GestureResponderEvent) => void;
  onPressOut: () => void;
};

type StampPressStageProps = {
  children: (props: StampPressStageRenderProps) => React.ReactNode;
  enabled?: boolean;
  pressDepth?: number;
  style?: React.ComponentProps<typeof View>['style'];
};

function useStampPressAnimation({
  enabled,
  pressDepth,
}: {
  enabled: boolean;
  pressDepth: number;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const stampButtonPress = useRef(new Animated.Value(0)).current;
  const stampMotion = useRef(new Animated.Value(0)).current;
  const stampLandingTranslateX = useRef(new Animated.Value(0)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const hasStampAnimationStartedRef = useRef(false);
  const [isTouchActive, setIsTouchActive] = useState(false);

  const stopStampAnimations = useCallback(() => {
    stampButtonPress.stopAnimation();
    stampMotion.stopAnimation();
    stampOpacity.stopAnimation();
  }, [stampButtonPress, stampMotion, stampOpacity]);

  useEffect(
    () => () => {
      stopStampAnimations();
    },
    [stopStampAnimations]
  );

  const onPressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!enabled) {
        return;
      }

      const pressLocationX = Number.isFinite(event.nativeEvent.locationX)
        ? event.nativeEvent.locationX
        : ANIMATED_STAMP_WIDTH / 2;

      setIsTouchActive(true);
      stopStampAnimations();
      hasStampAnimationStartedRef.current = true;
      stampLandingTranslateX.setValue(pressLocationX - ANIMATED_STAMP_WIDTH / 2);
      stampButtonPress.setValue(0);
      stampMotion.setValue(0);
      stampOpacity.setValue(1);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(stampMotion, {
            duration: STAMP_DROP_IN_MS,
            easing: Easing.out(Easing.cubic),
            toValue: 0.52,
            useNativeDriver: true,
          }),
          Animated.timing(stampMotion, {
            duration: STAMP_IMPACT_MS,
            easing: Easing.in(Easing.quad),
            toValue: 0.64,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(STAMP_BUTTON_PRESS_DELAY_MS),
          Animated.timing(stampButtonPress, {
            duration: STAMP_BUTTON_PRESS_MS,
            easing: Easing.out(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    },
    [enabled, stampButtonPress, stampLandingTranslateX, stampMotion, stampOpacity, stopStampAnimations]
  );

  const onPressOut = useCallback(() => {
    if (!hasStampAnimationStartedRef.current) {
      return;
    }

    setIsTouchActive(false);
    stopStampAnimations();

    Animated.parallel([
      Animated.sequence([
        Animated.timing(stampMotion, {
          duration: STAMP_RELEASE_SETTLE_MS,
          easing: Easing.out(Easing.quad),
          toValue: 0.64,
          useNativeDriver: true,
        }),
        Animated.timing(stampMotion, {
          duration: STAMP_PEEL_MS,
          easing: Easing.out(Easing.sin),
          toValue: 0.78,
          useNativeDriver: true,
        }),
        Animated.timing(stampMotion, {
          duration: STAMP_EXIT_MS,
          easing: Easing.in(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(stampButtonPress, {
          duration: STAMP_RELEASE_SETTLE_MS,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(STAMP_BUTTON_RELEASE_HOLD_MS),
        Animated.timing(stampButtonPress, {
          duration: STAMP_BUTTON_RELEASE_MS,
          easing: Easing.out(Easing.back(1.2)),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(STAMP_FADE_OUT_DELAY_MS),
        Animated.timing(stampOpacity, {
          duration: STAMP_FADE_OUT_MS,
          easing: Easing.out(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }

      stampOpacity.setValue(0);
      hasStampAnimationStartedRef.current = false;
    });
  }, [stampButtonPress, stampMotion, stampOpacity, stopStampAnimations]);

  const travelDistance = Math.max(320, windowWidth);

  const buttonAnimatedStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: stampButtonPress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, pressDepth],
          }),
        },
        {
          scale: stampButtonPress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.985],
          }),
        },
      ],
    }),
    [pressDepth, stampButtonPress]
  );

  const stampActorStyle = useMemo(
    () => ({
      opacity: stampOpacity,
      transform: [
        {
          translateX: Animated.add(
            stampMotion.interpolate({
              inputRange: [0, 0.38, 0.58, 0.78, 1],
              outputRange: [travelDistance * 0.82, 42, 0, -92, -travelDistance * 0.9],
            }),
            Animated.multiply(
              stampLandingTranslateX,
              stampMotion.interpolate({
                inputRange: [0, 0.25, 0.38, 0.78, 0.95, 1],
                outputRange: [0, 0.6, 1, 1, 0.35, 0],
              })
            )
          ),
        },
        {
          translateY: stampMotion.interpolate({
            inputRange: [0, 0.38, 0.58, 0.78, 1],
            outputRange: [-20, -46, 3, -20, -28],
          }),
        },
        {
          rotate: stampMotion.interpolate({
            inputRange: [0, 0.38, 0.58, 0.78, 1],
            outputRange: ['10deg', '-5deg', '-7deg', '-20deg', '-28deg'],
          }),
        },
        {
          scale: stampMotion.interpolate({
            inputRange: [0, 0.38, 0.58, 0.78, 1],
            outputRange: [0.92, 1.06, 1, 1.03, 0.96],
          }),
        },
      ],
    }),
    [stampLandingTranslateX, stampMotion, stampOpacity, travelDistance]
  );

  return {
    buttonAnimatedStyle,
    isTouchActive,
    onPressIn,
    onPressOut,
    stampActorStyle,
  };
}

export function StampPressStage({
  children,
  enabled = true,
  pressDepth = 5,
  style,
}: StampPressStageProps) {
  const { buttonAnimatedStyle, isTouchActive, onPressIn, onPressOut, stampActorStyle } =
    useStampPressAnimation({
      enabled,
      pressDepth,
    });

  return (
    <View style={[styles.stage, style]}>
      {children({
        buttonAnimatedStyle,
        isTouchActive,
        onPressIn,
        onPressOut,
      })}
      <AnimatedStamp style={stampActorStyle} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    overflow: 'visible',
  },
});
