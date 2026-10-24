import { StampNoticeBadge } from '@/components/stamp-notice-badge';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GroupStampStatus, getGroupStampStatus } from '@/components/group-stamp-status';
import { UncollectedStampArtwork } from '@/components/uncollected-stamp-artwork';
import type { Stampbox } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

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
      accessibilityLabel={groupAccessibilityLabel ?? `Stempel ${item.number || '--'}: ${item.name}. ${item.hasVisited ? 'Besucht' : 'Unbesucht'}`}
      accessibilityRole={selectionMode ? 'checkbox' : 'button'}
      accessibilityState={{ disabled, ...(selectionMode ? { checked: selected } : {}) }}
      aria-checked={selectionMode ? selected : undefined}
      accessibilityHint={onLongPress ? 'Gedrückt halten, um mehrere Stempelstellen auszuwählen' : undefined}
      testID={`stamp-list-item-${item.ID}`}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      style={({ pressed }) => [
        styles.card,
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
          <LinearGradient colors={cardGradient(index, !!item.hasVisited)} style={styles.cardArtwork} />
        )}

        <View style={styles.cardBody}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {item.number || '--'} {'\u2022'} {item.name}
          </Text>
          <Text numberOfLines={groupActive ? 1 : 2} style={styles.cardDescription}>
            {item.description?.trim() || 'Keine Beschreibung verfügbar.'}
          </Text>

          <StampNoticeBadge value={item.activeNotices} />
          <View style={styles.cardMetaRow}>
            <View style={[styles.statePill, item.hasVisited ? styles.statePillVisited : styles.statePillOpen]}>
              <Feather
                color={item.hasVisited ? '#2e6b4b' : '#7a6a4a'}
                name={item.hasVisited ? 'check' : 'x'}
                size={11}
              />
              <Text
                style={[
                  styles.statePillLabel,
                  item.hasVisited ? styles.statePillLabelVisited : styles.statePillLabelOpen,
                ]}>
                {item.hasVisited ? 'Besucht' : 'Unbesucht'}
              </Text>
            </View>
            {metaLabel ? <Text style={styles.distanceLabel}>{metaLabel}</Text> : null}
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
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  cardWithGroup: {
    minHeight: 152,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardPressed: {
    opacity: 0.85,
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
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  cardDescription: {
    color: '#6b7a6b',
    fontSize: 12,
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
    color: '#2e6b4b',
  },
  statePillLabelOpen: {
    color: '#7a6a4a',
  },
  distanceLabel: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  cardChevron: {
    flexShrink: 0,
  },
});
