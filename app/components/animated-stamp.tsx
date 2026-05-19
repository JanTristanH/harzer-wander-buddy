import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export const ANIMATED_STAMP_WIDTH = 96;

type AnimatedStampProps = {
  style?: React.ComponentProps<typeof Animated.View>['style'];
};

const WOOD = '#8f5538';
const WOOD_DARK = '#5b3325';
const WOOD_LIGHT = '#b97956';
const WOOD_SHADOW = '#3d2118';

export function AnimatedStamp({ style }: AnimatedStampProps) {
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.stampActor, style]}>
      <View style={styles.stampHandle}>
        <View style={styles.stampHandleTop}>
          <View style={styles.stampHandleHighlight} />
          <View style={styles.stampHandleHighlightSmall} />
          <View style={styles.stampHandleHole} />
          <View style={styles.stampHandleHoleInner} />
        </View>

        <View style={styles.stampNeck}>
          <View style={styles.stampNeckUpper}>
            <View style={styles.neckUpperHighlight} />
            <View style={styles.neckUpperShadow} />
          </View>

          <View style={styles.stampNeckFlare}>
            <View style={styles.neckFlareHighlight} />
            <View style={styles.neckFlareShadow} />
          </View>
        </View>
      </View>

      <View style={styles.stampFace}>
        <View style={styles.baseHighlight} />
        <View style={styles.baseDarkRim} />

        <View style={styles.inkSmudgeLeft} />
        <View style={styles.inkSmudgeRight} />
        <View style={styles.inkSmudgeCenter} />

        <View style={styles.stampFaceInner}>
          <View style={styles.sealFace}>
            <Feather color="#2f302c" name="check" size={15} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stampActor: {
    position: 'absolute',
    left: 0,
    top: -103,
    width: ANIMATED_STAMP_WIDTH,
    height: 134,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  stampHandle: {
    alignItems: 'center',
    marginBottom: -5,
    zIndex: 2,
  },

  stampHandleTop: {
    width: 64,
    height: 58,
    borderRadius: 34,
    backgroundColor: WOOD,
    borderWidth: 2,
    borderColor: WOOD_DARK,

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#24140d',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 6,
  },

  stampHandleHighlight: {
    position: 'absolute',
    top: 11,
    left: 15,
    width: 25,
    height: 8,
    borderRadius: 8,
    backgroundColor: WOOD_LIGHT,
    opacity: 0.48,
    transform: [{ rotate: '-18deg' }],
  },

  stampHandleHighlightSmall: {
    position: 'absolute',
    top: 22,
    left: 12,
    width: 15,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#d19a77',
    opacity: 0.24,
    transform: [{ rotate: '-22deg' }],
  },

  stampHandleHole: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3f241a',
    borderWidth: 2,
    borderColor: '#c08a68',
    opacity: 0.95,
  },

  stampHandleHoleInner: {
    position: 'absolute',
    top: 11,
    right: 13,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#23120d',
    opacity: 0.9,
  },

  stampNeck: {
    alignItems: 'center',
    marginTop: -5,
  },

  stampNeckUpper: {
    width: 30,
    height: 24,
    backgroundColor: WOOD,

    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: WOOD_DARK,

    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,

    overflow: 'hidden',
    zIndex: 2,
  },

  neckUpperHighlight: {
    position: 'absolute',
    top: 2,
    left: 5,
    width: 6,
    height: 22,
    borderRadius: 6,
    backgroundColor: WOOD_LIGHT,
    opacity: 0.23,
  },

  neckUpperShadow: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 7,
    height: 24,
    backgroundColor: WOOD_SHADOW,
    opacity: 0.22,
  },

  stampNeckFlare: {
    width: 52,
    height: 20,
    marginTop: -3,
    backgroundColor: WOOD,

    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 2,
    borderColor: WOOD_DARK,

    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,

    overflow: 'hidden',
    zIndex: 1,
  },

  neckFlareHighlight: {
    position: 'absolute',
    top: 4,
    left: 10,
    width: 20,
    height: 5,
    borderRadius: 5,
    backgroundColor: WOOD_LIGHT,
    opacity: 0.22,
    transform: [{ rotate: '-7deg' }],
  },

  neckFlareShadow: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 12,
    height: 22,
    backgroundColor: WOOD_SHADOW,
    opacity: 0.18,
  },

  stampFace: {
    width: 88,
    height: 42,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,

    backgroundColor: WOOD,
    borderWidth: 2.5,
    borderColor: WOOD_DARK,

    alignItems: 'center',
    justifyContent: 'flex-end',

    paddingBottom: 2,

    shadowColor: '#16120f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 9,
    elevation: 8,

    overflow: 'visible',
  },

  baseHighlight: {
    position: 'absolute',
    top: 6,
    left: 15,
    width: 38,
    height: 7,
    borderRadius: 7,
    backgroundColor: WOOD_LIGHT,
    opacity: 0.25,
    transform: [{ rotate: '-6deg' }],
  },

  baseDarkRim: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 1,
    height: 12,
    borderRadius: 10,
    backgroundColor: '#2a1d17',
    opacity: 0.22,
  },

  inkSmudgeLeft: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    width: 9,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#1b1713',
    opacity: 0.55,
    transform: [{ rotate: '-12deg' }],
  },

  inkSmudgeRight: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    width: 7,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#1b1713',
    opacity: 0.45,
    transform: [{ rotate: '16deg' }],
  },

  inkSmudgeCenter: {
    position: 'absolute',
    bottom: 6,
    left: 39,
    width: 10,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#15120f',
    opacity: 0.32,
    transform: [{ rotate: '8deg' }],
  },

  stampFaceInner: {
    width: 78,
    height: 24,
    borderRadius: 12,

    backgroundColor: '#1b1c17',
    borderWidth: 2,
    borderColor: '#0f100c',

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: -9,
  },

  sealFace: {
    width: 60,
    height: 17,
    borderRadius: 9,

    backgroundColor: '#b99175',
    borderWidth: 1.5,
    borderColor: '#2d2e28',

    alignItems: 'center',
    justifyContent: 'center',

    opacity: 0.9,
  },
});