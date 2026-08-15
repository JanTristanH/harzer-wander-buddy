import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GroupMemberStatusAvatar } from '@/components/group-member-status-avatar';
import type { Stampbox } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

type StampListItemProps = {
  item: Stampbox;
  index: number;
  onPress: () => void;
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

function parseStampedUserIds(value: Stampbox['stampedUserIds']) {
  if (Array.isArray(value)) {
    return new Set(value.map((id) => id.trim()).filter(Boolean));
  }

  const normalized = value?.trim();
  if (!normalized) {
    return new Set<string>();
  }

  if (normalized.startsWith('[')) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return new Set(
          parsed
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter(Boolean)
        );
      }
    } catch {
      // Some service versions return a comma-separated value instead of JSON.
    }
  }

  return new Set(normalized.split(',').map((id) => id.trim()).filter(Boolean));
}

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
  metaLabel,
  groupActive = false,
  groupMembers = [],
  currentUser,
  groupSize,
}: StampListItemProps) {
  const { accessToken } = useAuth();
  const artworkUri = item.heroImageUrl?.trim() || item.image?.trim() || '';
  const artworkSource = artworkUri ? buildAuthenticatedImageSource(artworkUri, accessToken) : null;
  const stampedUserIds = parseStampedUserIds(item.stampedUserIds);
  const memberStatuses = [
    {
      id: 'self',
      name: 'Du',
      avatarName: currentUser?.name?.trim() || 'Du',
      picture: currentUser?.picture,
      visited: Boolean(item.hasVisited),
    },
    ...groupMembers.map((member) => ({
      id: member.id,
      name: member.name,
      avatarName: member.name,
      picture: member.picture,
      visited: stampedUserIds.has(member.id),
    })),
  ];
  const resolvedGroupSize = Math.max(1, groupSize ?? memberStatuses.length);
  const derivedVisitedCount = memberStatuses.filter((member) => member.visited).length;
  const resolvedVisitedCount = Math.max(
    0,
    Math.min(resolvedGroupSize, item.totalGroupStampings ?? derivedVisitedCount)
  );
  const groupProgressState =
    resolvedVisitedCount === resolvedGroupSize
      ? 'complete'
      : resolvedVisitedCount > 0
        ? 'partial'
        : 'open';
  const visibleMemberStatuses = memberStatuses.slice(0, 5);
  const hiddenMemberCount = Math.max(0, resolvedGroupSize - visibleMemberStatuses.length);
  const groupAccessibilityLabel = groupActive
    ? `Stempel ${item.number || '--'}: ${item.name}. ${
        item.hasVisited ? 'Besucht' : 'Unbesucht'
      }. Gruppe: ${resolvedVisitedCount} von ${resolvedGroupSize} besucht. ${memberStatuses
        .map((member) => `${member.name} ${member.visited ? 'besucht' : 'unbesucht'}`)
        .join(', ')}`
    : undefined;

  return (
    <Pressable
      accessibilityLabel={groupAccessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        groupActive && styles.cardWithGroup,
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.cardMainRow}>
        {artworkSource ? (
          <Image cachePolicy="disk" contentFit="cover" source={artworkSource} style={styles.cardArtwork} />
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

        <Feather color="#8b957f" name="chevron-right" size={18} style={styles.cardChevron} />
      </View>

      {groupActive ? (
        <View style={styles.groupProgress}>
          <View
            style={[
              styles.groupProgressPill,
              groupProgressState === 'complete'
                ? styles.groupProgressPillComplete
                : groupProgressState === 'partial'
                  ? styles.groupProgressPillPartial
                  : styles.groupProgressPillOpen,
            ]}>
            <Text
              style={[
                styles.groupProgressLabel,
                groupProgressState === 'complete'
                  ? styles.groupProgressLabelComplete
                  : groupProgressState === 'partial'
                    ? styles.groupProgressLabelPartial
                    : styles.groupProgressLabelOpen,
              ]}>
              {resolvedVisitedCount} von {resolvedGroupSize} in der Gruppe
            </Text>
          </View>

          <View style={styles.memberStatusRow}>
            {visibleMemberStatuses.map((member, memberIndex) => (
              <GroupMemberStatusAvatar
                accessible={false}
                accessibilityName={member.name}
                image={member.picture}
                index={memberIndex}
                key={member.id}
                name={member.avatarName}
                size={28}
                testID={`group-member-avatar-${member.id}`}
                visited={member.visited}
              />
            ))}
            {hiddenMemberCount > 0 ? (
              <View
                accessibilityLabel={`${hiddenMemberCount} weitere Gruppenmitglieder`}
                style={styles.memberOverflow}>
                <Text style={styles.memberOverflowLabel}>+{hiddenMemberCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

export const StampListItem = React.memo(StampListItemComponent);

const styles = StyleSheet.create({
  card: {
    minHeight: 100,
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
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
  groupProgress: {
    gap: 6,
  },
  groupProgressPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  groupProgressPillComplete: {
    backgroundColor: '#e2eee6',
  },
  groupProgressPillPartial: {
    backgroundColor: '#fff1cc',
  },
  groupProgressPillOpen: {
    backgroundColor: '#f5e2df',
  },
  groupProgressLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  groupProgressLabelComplete: {
    color: '#2e6b4b',
  },
  groupProgressLabelPartial: {
    color: '#805f12',
  },
  groupProgressLabelOpen: {
    color: '#8a4b43',
  },
  memberStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberOverflow: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6e8e2',
  },
  memberOverflowLabel: {
    color: '#5c6a5d',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  cardChevron: {
    flexShrink: 0,
  },
});
