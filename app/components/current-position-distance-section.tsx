import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/section-card';
import { SkeletonBlock } from '@/components/skeleton';
import { AppColors } from '@/constants/theme';

export type CurrentPositionDistanceSectionStatus =
  | 'no-coordinates'
  | 'idle'
  | 'denied'
  | 'loading'
  | 'error'
  | 'ready';

type CurrentPositionDistanceSectionProps = React.PropsWithChildren<{
  title: string;
  status: CurrentPositionDistanceSectionStatus;
  noCoordinatesText: string;
  promptText?: string;
  errorText?: string;
  actionLabel?: string;
  retryLabel?: string;
  errorActionLabel?: string;
  onRequestDistance?: () => void;
  loadingLineWidths?: (number | `${number}%`)[];
}>;

export function CurrentPositionDistanceSection({
  title,
  status,
  noCoordinatesText,
  promptText,
  errorText,
  actionLabel = 'Distanz berechnen',
  retryLabel = 'Erneut versuchen',
  errorActionLabel,
  onRequestDistance,
  loadingLineWidths = ['72%', '56%'],
  children,
}: CurrentPositionDistanceSectionProps) {
  return (
    <SectionCard title={title}>
      {status === 'no-coordinates' ? (
        <Text style={styles.emptySectionText}>{noCoordinatesText}</Text>
      ) : status === 'idle' || status === 'denied' || (status === 'error' && errorActionLabel) ? (
        <View style={styles.routePrompt}>
          <Text style={styles.emptySectionText}>{status === 'error' ? errorText : promptText}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRequestDistance}
            style={({ pressed }) => [styles.routeActionButton, pressed && styles.sectionActionPressed]}>
            <MaterialCommunityIcons color="black" name="map-marker-distance" size={16} />
            <Text style={styles.routeActionButtonLabel}>
              {status === 'idle' ? actionLabel : status === 'denied' ? retryLabel : errorActionLabel}
            </Text>
          </Pressable>
        </View>
      ) : status === 'loading' ? (
        <>
          {loadingLineWidths.map((width, index) => (
            <SkeletonBlock key={`${width}-${index}`} height={14} radius={999} width={width} />
          ))}
        </>
      ) : status === 'error' ? (
        <Text style={styles.emptySectionText}>{errorText}</Text>
      ) : (
        children
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  emptySectionText: {
    color: AppColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  routePrompt: {
    gap: 10,
  },
  routeActionButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: AppColors.actionSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeActionButtonLabel: {
    color: AppColors.textSecondary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  sectionActionPressed: {
    opacity: 0.85,
  },
});
