import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
        <Feather color="#2e6b4b" name={icon} size={16} />
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
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
            <Feather color="#2e6b4b" name="list" size={15} />
            <Text style={styles.openAllLabel}>Vollständige Timeline</Text>
          </View>
        </Pressable>
      ) : null}
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
    elevation: 2,
  },
  sectionTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
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
    color: '#1e2a1e',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  metricHint: {
    color: '#6b7a6b',
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
    color: '#2e6b4b',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
