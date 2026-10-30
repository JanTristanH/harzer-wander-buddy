import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { AppColors, Radii, Spacing } from '@/constants/theme';

type SectionCardProps = PropsWithChildren<ViewProps & {
  title: string;
  action?: ReactNode;
}>;

/** Shared detail section; callers compose content and optional header actions. */
export function SectionCard({ title, action, children, style, ...props }: SectionCardProps) {
  return (
    <View {...props} style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    color: AppColors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
});
