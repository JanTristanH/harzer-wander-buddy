import { Design } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { GroupStampStatus, getGroupStampStatus } from '@/components/group-stamp-status';
import { UncollectedStampArtwork } from '@/components/uncollected-stamp-artwork';
import type { Stampbox } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

// Safari owns long presses unless text selection and its native callout are disabled.
const webCardInteractionStyle: (ViewStyle & React.CSSProperties) | undefined = Platform.OS === 'web' ? {
  userSelect: 'none' as const, WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
} : undefined;
const webCardInteractionProps = Platform.OS === 'web' ? {
  onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
} : {};

type StampListItemProps = {
  item: Stampbox;
  index: number;
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  disabled?: boolean;
  metaLabel?: string | null;
  groupActive?: boolean;
  groupMembers?: readonly {
    id: string;
    name: string;
    picture?: string;
  }[];
  currentUser?: {
    name?: string;
    picture?: string;
  };
  groupSize?: number;
};

function cardGradient(index: number, visited: boolean) {
  if (visited) {
    return index % 2 === 0
      ? (['#458962', '#8fd2a4'] as const)
      : (['#4a8464', '#c2dfae'] as const);
  }

  return index % 2 === 0
    ? (['#b6beac', '#e1d2bd'] as const)
    : (['#a6b39c', '#d7cfbb'] as const);
}

function StampListItemComponent({
  item,
  index,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
  disabled = false,
  metaLabel,
  groupActive = false,
  groupMembers = [],
  currentUser,
  groupSize,
}: StampListItemProps) {
  const { accessToken, isAuthenticated } = useAuth();
  const consumedLongPress = React.useRef(false);
  const showUncollectedArtwork = isAuthenticated && !item.hasVisited;
  const artworkUri = item.heroImageUrl?.trim() || item.image?.trim() || '';
  const artworkSource = React.useMemo(
    () => artworkUri ? buildAuthenticatedImageSource(artworkUri, accessToken) : null,
    [artworkUri, accessToken]
  );
  const { memberStatuses, resolvedGroupSize, resolvedVisitedCount } = getGroupStampStatus({
    item, groupMembers, currentUser, groupSize,
  });
  const groupAccessibilityLabel = groupActive
    ? `Stempel ${item.number || '--'}: ${item.name}. ${
        item.hasVisited ? 'Besucht' : 'Unbesucht'
      }. Gruppe: ${resolvedVisitedCount} von ${resolvedGroupSize} besucht. ${memberStatuses
        .map((member) => `${member.name} ${member.visited ? 'besucht' : 'unbesucht'}`)
        .join(', ')}`
    : undefined;

  return (
    <Pressable
      {...webCardInteractionProps}
      accessibilityLabel={groupAccessibilityLabel ?? `Stempel ${item.number || '--'}: ${item.name}. ${isAuthenticated ? item.hasVisited ? 'Besucht' : 'Unbesucht' : 'Entdecken'}`}
      accessibilityRole={selectionMode ? 'checkbox' : 'button'}
      accessibilityState={{ disabled, ...(selectionMode ? { checked: selected } : {}) }}
      aria-checked={selectionMode ? selected : undefined}
      accessibilityHint={onLongPress ? 'Gedrückt halten, um mehrere Stempelstellen auszuwählen' : undefined}
      testID={`stamp-list-item-${item.ID}`}
      disabled={disabled}
      onPressIn={() => { consumedLongPress.current = false; }}
      onPress={() => {
        if (consumedLongPress.current) { consumedLongPress.current = false; return; }
        onPress();
      }}
      onLongPress={onLongPress ? () => { consumedLongPress.current = true; onLongPress(); } : undefined}
      delayLongPress={500}
      style={({ pressed }) => [
        styles.card,
        webCardInteractionStyle,
        groupActive && styles.cardWithGroup,
        selectionMode && styles.cardSelectable,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.cardMainRow}>
        {artworkSource ? (
          showUncollectedArtwork ? (
            <UncollectedStampArtwork
              source={artworkSource}
              style={styles.cardArtwork}
            />
          ) : (
            <Image
              cachePolicy="disk"
              contentFit="cover"
              source={artworkSource}
              style={styles.cardArtwork}
              testID="stamp-artwork-color"
            />
          )
        ) : (
          <LinearGradient accessible={false} colors={cardGradient(index, !!item.hasVisited)} style={[styles.cardArtwork, styles.artworkFallback]}>
            <Feather color={Design.color.brandDeep} name="map-pin" size={24} />
            <Text selectable={false} style={styles.artworkNumber}>{item.number || 'HWN'}</Text>
          </LinearGradient>
        )}

        <View style={styles.cardBody}>
          <Text selectable={false} numberOfLines={2} style={styles.cardTitle}>
            {item.number || '--'} {'\u2022'} {item.name}
          </Text>
          <Text selectable={false} numberOfLines={1} style={styles.cardDescription}>
            {item.description?.trim() || 'Keine Beschreibung verfügbar.'}
          </Text>

          <View style={styles.cardMetaRow}>
            <View style={[styles.statePill, item.hasVisited ? styles.statePillVisited : styles.statePillOpen]}>
              <Feather
                color={item.hasVisited ? Design.color.brand : Design.color.warning}
                name={item.hasVisited ? 'check' : 'circle'}
                size={11}
              />
              <Text
                selectable={false}
                style={[
                  styles.statePillLabel,
                  item.hasVisited ? styles.statePillLabelVisited : styles.statePillLabelOpen,
                ]}>
                {isAuthenticated ? item.hasVisited ? 'Besucht' : 'Unbesucht' : 'Entdecken'}
              </Text>
            </View>
            {metaLabel ? <Text selectable={false} style={styles.distanceLabel}>{metaLabel}</Text> : null}
          </View>
        </View>

        <Feather color={selected ? '#2e6b4b' : '#8b957f'} name={selectionMode ? selected ? 'check-square' : 'square' : 'chevron-right'} size={selectionMode ? 24 : 18} style={styles.cardChevron} />
      </View>

      {groupActive ? (
        <GroupStampStatus
          accessible={false}
          item={item}
          groupMembers={groupMembers}
          currentUser={currentUser}
          groupSize={groupSize}
        />
      ) : null}
    </Pressable>
  );
}

export const StampListItem = React.memo(StampListItemComponent);

const styles = StyleSheet.create({
  cardSelectable: { borderColor: '#d9e2d9' },
  cardSelected: { borderColor: '#2e6b4b', backgroundColor: '#edf5ee' },
  card: {
    flex: 1,
    minHeight: 100,
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: Design.color.border,
  },
  cardWithGroup: {
    minHeight: 152,
  },
  cardMainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardPressed: {
    opacity: 0.85,
  },
  artworkFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  artworkNumber: {
    color: Design.color.brandDeep,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardArtwork: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  cardBody: {
    flex: 1,
    minWidth: 1,
  },
  cardTitle: {
    color: Design.color.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  cardDescription: {
    color: Design.color.muted,
    fontSize: 13,
    lineHeight: 16,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statePillVisited: {
    backgroundColor: '#e2eee6',
  },
  statePillOpen: {
    backgroundColor: '#f0e9dd',
  },
  statePillLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  statePillLabelVisited: {
    color: Design.color.brand,
  },
  statePillLabelOpen: {
    color: Design.color.warning,
  },
  distanceLabel: {
    color: Design.color.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  cardChevron: {
    flexShrink: 0,
  },
});
