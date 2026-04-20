import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SkeletonBlock } from '@/components/skeleton';

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
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {status === 'no-coordinates' ? (
        <Text style={styles.emptySectionText}>{noCoordinatesText}</Text>
      ) : status === 'idle' ? (
        <View style={styles.routePrompt}>
          <Text style={styles.emptySectionText}>{promptText}</Text>
          <Pressable
            onPress={onRequestDistance}
            style={({ pressed }) => [styles.routeActionButton, pressed && styles.sectionActionPressed]}>
            <MaterialCommunityIcons color="black" name="map-marker-distance" size={16} />
            <Text style={styles.routeActionButtonLabel}>{actionLabel}</Text>
          </Pressable>
        </View>
      ) : status === 'denied' ? (
        <View style={styles.routePrompt}>
          <Text style={styles.emptySectionText}>{promptText}</Text>
          <Pressable
            onPress={onRequestDistance}
            style={({ pressed }) => [styles.routeActionButton, pressed && styles.sectionActionPressed]}>
            <MaterialCommunityIcons color="black" name="map-marker-distance" size={16} />
            <Text style={styles.routeActionButtonLabel}>{retryLabel}</Text>
          </Pressable>
        </View>
      ) : status === 'loading' ? (
        <>
          {loadingLineWidths.map((width, index) => (
            <SkeletonBlock key={`${width}-${index}`} height={14} radius={999} width={width} />
          ))}
        </>
      ) : status === 'error' ? (
        errorActionLabel ? (
          <View style={styles.routePrompt}>
            <Text style={styles.emptySectionText}>{errorText}</Text>
            <Pressable
              onPress={onRequestDistance}
              style={({ pressed }) => [styles.routeActionButton, pressed && styles.sectionActionPressed]}>
              <MaterialCommunityIcons color="black" name="map-marker-distance" size={16} />
              <Text style={styles.routeActionButtonLabel}>{errorActionLabel}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.emptySectionText}>{errorText}</Text>
        )
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  emptySectionText: {
    color: '#6b7a6b',
    fontSize: 13,
    lineHeight: 18,
  },
  routePrompt: {
    gap: 10,
  },
  routeActionButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#eef4ef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeActionButtonLabel: {
    color: '#2e3a2e',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  sectionActionPressed: {
    opacity: 0.85,
  },
});
