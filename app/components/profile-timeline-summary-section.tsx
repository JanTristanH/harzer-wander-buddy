import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/section-card';
import { AppColors } from '@/constants/theme';

type TimelineMetricCardProps = {
  icon: 'clock' | 'calendar';
  label: string;
  value: number;
  onPress?: () => void;
};

function TimelineMetricCard({ icon, label, value, onPress }: TimelineMetricCardProps) {
  const visitLabel = value === 1 ? 'Besuch' : 'Besuche';

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.metricCard, pressed && onPress && styles.pressed]}>
      <View style={styles.metricIconWrap}>
        <Feather color={AppColors.primary} name={icon} size={16} />
      </View>
      <View style={styles.metricBody}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricHint}>{visitLabel}</Text>
      </View>
    </Pressable>
  );
}

type ProfileTimelineSummarySectionProps = {
  thisWeekCount: number;
  thisMonthCount: number;
  onOpenAll?: () => void;
  sectionTitle?: string;
};

export function ProfileTimelineSummarySection({
  thisWeekCount,
  thisMonthCount,
  onOpenAll,
  sectionTitle = 'Timeline',
}: ProfileTimelineSummarySectionProps) {
  return (
    <SectionCard title={sectionTitle} style={styles.section}>
      <View style={styles.metricRow}>
        <TimelineMetricCard icon="clock" label="Diese Woche" onPress={onOpenAll} value={thisWeekCount} />
        <TimelineMetricCard
          icon="calendar"
          label="Dieser Monat"
          onPress={onOpenAll}
          value={thisMonthCount}
        />
      </View>
      {onOpenAll ? (
        <Pressable onPress={onOpenAll} style={({ pressed }) => [styles.openAllButton, pressed && styles.pressed]}>
          <View style={styles.openAllContent}>
            <Feather color={AppColors.primary} name="list" size={15} />
            <Text style={styles.openAllLabel}>Vollständige Timeline</Text>
          </View>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  section: {
    elevation: 2,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#f8f6f1',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2eee6',
  },
  metricBody: {
    gap: 2,
  },
  metricLabel: {
    color: '#4d6d56',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  metricValue: {
    color: AppColors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  metricHint: {
    color: AppColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  openAllButton: {
    marginTop: 2,
    backgroundColor: '#f0e9dd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openAllContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openAllLabel: {
    color: AppColors.primary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
