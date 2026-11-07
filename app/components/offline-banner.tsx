import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/constants/theme';

type Props = {
  label: string;
  count: number;
  expanded: boolean;
  onPress(): void;
};

// The surrounding layout reserves space; this control never floats over a page.
export function OfflineBanner({ label, count, expanded, onPress }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Synchronisierungsstatus anzeigen${count ? `, ${count} Änderungen ausstehend` : ''}`}
      accessibilityState={{ expanded }} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Feather name={label === 'Offline' ? 'cloud-off' : 'refresh-cw'} size={20} color={AppColors.primary} />
      <Text style={styles.label}>{label}</Text>
      {count > 0 ? <View style={styles.badge}><Text style={styles.count}>{count}</Text></View> : null}
      <Feather name="chevron-right" size={20} color={AppColors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 18, borderWidth: 1, borderColor: '#d5e2d2', backgroundColor: '#e7edde' },
  pressed: { opacity: 0.75 },
  label: { flex: 1, color: AppColors.text, fontSize: 14, fontWeight: '600' },
  badge: { minWidth: 24, minHeight: 24, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.primary },
  count: { color: '#fff', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
