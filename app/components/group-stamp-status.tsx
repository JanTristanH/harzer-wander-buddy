import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GroupMemberStatusAvatar } from '@/components/group-member-status-avatar';
import type { Stampbox } from '@/lib/api';

export type GroupStampStatusProps = {
  item: Pick<Stampbox, 'hasVisited' | 'stampedUserIds' | 'totalGroupStampings'>;
  groupMembers?: readonly { id: string; name: string; picture?: string }[];
  currentUser?: { name?: string; picture?: string };
  groupSize?: number;
  accessible?: boolean;
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

export function getGroupStampStatus({
  item,
  groupMembers = [],
  currentUser,
  groupSize,
}: GroupStampStatusProps) {
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
  return { memberStatuses, resolvedGroupSize, resolvedVisitedCount };
}

export function GroupStampStatus({ accessible = true, ...props }: GroupStampStatusProps) {
  const { memberStatuses, resolvedGroupSize, resolvedVisitedCount } = getGroupStampStatus(props);
  const groupProgressState =
    resolvedVisitedCount === resolvedGroupSize
      ? 'complete'
      : resolvedVisitedCount > 0
        ? 'partial'
        : 'open';
  const visibleMemberStatuses = memberStatuses.slice(0, 5);
  const hiddenMemberCount = Math.max(0, resolvedGroupSize - visibleMemberStatuses.length);
  return (
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
            accessible={accessible}
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
  );
}

const styles = StyleSheet.create({
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
});
