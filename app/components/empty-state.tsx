import { Feather } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppColors, Fonts, Radii, Spacing } from '@/constants/theme';

export function EmptyState({
  title,
  body,
  image,
  ctaLabel,
  ctaIconName,
  onCtaPress,
  variant = 'default',
  style,
}: {
  title: string;
  body: string;
  image?: ImageSource;
  variant?: 'default' | 'discovery';
  style?: StyleProp<ViewStyle>;
  ctaLabel?: string;
  ctaIconName?: ComponentProps<typeof Feather>['name'];
  onCtaPress?: () => void;
}) {
  return (
    <View style={[styles.emptyCard, variant === 'discovery' && styles.discoveryCard, style]}>
      <Text style={[styles.emptyTitle, variant === 'discovery' ? styles.discoveryTitle : styles.defaultFont]}>
        {title}
      </Text>
      {image ? (
        <Image
          contentFit="contain"
          source={image}
          style={[styles.emptyIllustration, variant === 'discovery' && styles.discoveryIllustration]}
        />
      ) : null}
      <Text style={[styles.emptyBody, variant === 'discovery' ? styles.discoveryBody : styles.defaultFont]}>
        {body}
      </Text>
      {ctaLabel && onCtaPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          onPress={onCtaPress}
          style={({ pressed }) => [styles.emptyCtaButton, pressed && styles.pressed]}>
          <Feather color={AppColors.background} name={ctaIconName ?? 'search'} size={16} />
          <Text style={styles.emptyCtaLabel}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: AppColors.surface,
    borderRadius: Radii.card,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  emptyTitle: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 6,
  },
  emptyBody: {
    color: AppColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyIllustration: {
    alignSelf: 'center',
    height: 120,
    marginBottom: 12,
    width: 120,
  },
  emptyCtaButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emptyCtaLabel: {
    fontFamily: Fonts.sans,
    color: AppColors.background,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  discoveryCard: {
    backgroundColor: AppColors.discoverySurface,
    borderRadius: Radii.discovery,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
    shadowOpacity: 0,
    elevation: 0,
  },
  discoveryTitle: {
    color: AppColors.textSecondary,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 0,
  },
  discoveryBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  discoveryIllustration: { marginBottom: 0 },
  pressed: { opacity: 0.85 },
  defaultFont: { fontFamily: Fonts.sans },
});
