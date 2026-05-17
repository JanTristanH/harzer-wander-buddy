import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonBlock } from '@/components/skeleton';

const lockedIllustration = require('@/assets/images/buddy/telescope.png');

export function LockedGuestRows({
  body = 'Melde dich an, um diese Details freizuschalten.',
  ctaLabel = 'Anmelden',
  onSignIn,
}: {
  body?: string;
  ctaLabel?: string;
  onSignIn: () => void;
}) {
  return (
    <View style={styles.lockedRowsWrap}>
      <View pointerEvents="none" style={styles.lockedRows}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.lockedRow}>
            <SkeletonBlock height={42} radius={12} tone="strong" width={42} />
            <View style={styles.lockedRowCopy}>
              <SkeletonBlock
                height={14}
                radius={999}
                tone="strong"
                width={`${72 - item * 8}%` as `${number}%`}
              />
              <SkeletonBlock
                height={12}
                radius={999}
                width={`${48 + item * 6}%` as `${number}%`}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.lockedOverlay}>
        <View style={styles.lockIcon}>
          <Feather color="#2e6b4b" name="lock" size={15} />
        </View>
        <Text style={styles.lockedText}>{body}</Text>
        <Pressable
          onPress={onSignIn}
          style={({ pressed }) => [styles.signInButton, pressed && styles.signInButtonPressed]}>
          <Text style={styles.signInButtonLabel}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SignInRequiredScreen({
  title,
  body,
  ctaLabel = 'Anmelden',
  onSignIn,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  onSignIn: () => void;
}) {
  return (
    <SafeAreaView style={styles.screenSafeArea}>
      <View style={styles.screenContent}>
        <View style={styles.screenCard}>
          <Image contentFit="contain" source={lockedIllustration} style={styles.illustration} />
          <Text style={styles.screenTitle}>{title}</Text>
          <Text style={styles.screenBody}>{body}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onSignIn}
            style={({ pressed }) => [styles.screenButton, pressed && styles.signInButtonPressed]}>
            <Feather color="#f5f3ee" name="log-in" size={16} />
            <Text style={styles.screenButtonLabel}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lockedRowsWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  lockedRows: {
    gap: 8,
    opacity: 0.38,
  },
  lockedRow: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: '#f5f7f2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lockedRowCopy: {
    flex: 1,
    gap: 8,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.66)',
    gap: 8,
  },
  lockIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef7f0',
  },
  lockedText: {
    color: '#445244',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  signInButton: {
    borderRadius: 999,
    backgroundColor: '#2e6b4b',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  signInButtonPressed: {
    opacity: 0.86,
  },
  signInButtonLabel: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  screenSafeArea: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  screenContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  screenCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  illustration: {
    width: 150,
    height: 118,
  },
  screenTitle: {
    color: '#1e2a1e',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  screenBody: {
    color: '#5b675a',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  screenButton: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#2e6b4b',
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  screenButtonLabel: {
    color: '#f5f3ee',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});
