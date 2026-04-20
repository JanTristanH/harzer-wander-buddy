import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

type MarkerKind = 'visited-stamp' | 'open-stamp' | 'parking';
type MapSelectionSheetMode = 'expanded' | 'compact';

export function MapSelectionSheet({
  bottomOffset,
  mode,
  item,
  metadata,
  primaryActionLabel,
  onPrimaryActionPress,
  primaryActionDisabled,
  onDetailsPress,
  onToggleExpand,
  onHeightChange,
}: {
  bottomOffset: number;
  mode: MapSelectionSheetMode;
  item: {
    kind: MarkerKind;
    title: string;
    description?: string;
    imageUrl?: string;
  };
  metadata?: string;
  primaryActionLabel?: string;
  onPrimaryActionPress?: () => void;
  primaryActionDisabled?: boolean;
  onDetailsPress?: () => void;
  onToggleExpand?: () => void;
  onHeightChange?: (height: number) => void;
}) {
  const { accessToken } = useAuth();
  const isCompact = mode === 'compact';
  const isInteractive = Boolean(onDetailsPress);
  const imageSource = item.imageUrl
    ? buildAuthenticatedImageSource(item.imageUrl, accessToken)
    : null;
  const handleSheetPress = isCompact ? onToggleExpand : onDetailsPress;

  return (
    <Pressable
      onLayout={(event: LayoutChangeEvent) => onHeightChange?.(event.nativeEvent.layout.height)}
      onPress={handleSheetPress}
      style={({ pressed }) => [
        styles.bottomSheet,
        { bottom: bottomOffset },
        pressed && (isCompact || isInteractive) && styles.pressed,
      ]}>
      <View pointerEvents="none" style={[styles.detailRow, isCompact && styles.detailRowCompact]}>
        {isCompact ? null : imageSource ? (
          <Image cachePolicy="disk" contentFit="cover" source={imageSource} style={styles.detailArtwork} />
        ) : (
          <LinearGradient
            colors={
              item.kind === 'visited-stamp'
                ? ['#4b875f', '#8fd2a4']
                : item.kind === 'open-stamp'
                  ? ['#ab8d7d', '#dbc6b7']
                  : ['#2f7dd7', '#6cb1ff']
            }
            style={styles.detailArtwork}
          />
        )}
        <View style={styles.detailCopy}>
          <Text numberOfLines={1} style={styles.detailTitle}>
            {item.title}
          </Text>
          {!isCompact && item.description?.trim() ? (
            <Text numberOfLines={2} style={styles.detailDescription}>
              {item.description}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.detailBadge,
            item.kind === 'visited-stamp'
              ? styles.detailBadgeVisited
              : item.kind === 'open-stamp'
                ? styles.detailBadgeOpen
                : styles.detailBadgeParking,
          ]}>
          <Text
            style={[
              styles.detailBadgeText,
              item.kind === 'visited-stamp'
                ? styles.detailBadgeTextVisited
                : item.kind === 'open-stamp'
                  ? styles.detailBadgeTextOpen
                  : styles.detailBadgeTextParking,
            ]}>
            {item.kind === 'visited-stamp'
              ? 'Besucht'
              : item.kind === 'open-stamp'
                ? 'Unbesucht'
                : 'Parkplatz'}
          </Text>
        </View>
      </View>

      {!isCompact && metadata?.trim() ? (
        <View pointerEvents="none" style={styles.detailMetaRow}>
          <Text numberOfLines={2} style={styles.detailMeta}>
            {metadata}
          </Text>
        </View>
      ) : null}

      {!isCompact && (primaryActionLabel || onDetailsPress) ? (
        <View style={styles.actionRow}>
          {primaryActionLabel ? (
            <Pressable
              disabled={primaryActionDisabled}
              onPress={onPrimaryActionPress}
              style={({ pressed }) => [
                styles.primaryAction,
                primaryActionDisabled && styles.primaryActionDisabled,
                pressed && !primaryActionDisabled && styles.pressed,
              ]}>
              <Text style={styles.primaryActionLabel}>{primaryActionLabel}</Text>
            </Pressable>
          ) : null}
          {onDetailsPress ? (
            <Pressable
              onPress={onDetailsPress}
              style={({ pressed }) => [styles.detailAction, pressed && styles.pressed]}>
              <Text style={styles.detailActionLabel}>Details oeffnen</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  bottomSheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d8ded6',
    alignSelf: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailRowCompact: {
    gap: 10,
  },
  detailArtwork: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  detailCopy: {
    flex: 1,
    minWidth: 1,
  },
  detailTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  detailDescription: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  detailBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailBadgeVisited: {
    backgroundColor: '#deebe2',
  },
  detailBadgeOpen: {
    backgroundColor: '#f0e7e0',
  },
  detailBadgeParking: {
    backgroundColor: '#e3effc',
  },
  detailBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  detailBadgeTextVisited: {
    color: '#2e6b4b',
  },
  detailBadgeTextOpen: {
    color: '#7d5f52',
  },
  detailBadgeTextParking: {
    color: '#2f7dd7',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailMeta: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: '#2e6b4b',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionDisabled: {
    backgroundColor: '#b8c7bb',
  },
  primaryActionLabel: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  detailAction: {
    flex: 1,
    backgroundColor: '#eef3ed',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActionLabel: {
    color: '#2e6b4b',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
