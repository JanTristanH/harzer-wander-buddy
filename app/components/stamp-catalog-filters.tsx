import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SPECIAL_STAMP_COLOR, stampThemeLabels, type StampTypeFilter } from '@/lib/stamp-catalog';

export function StampCatalogFilters({ type, theme, themes, onTypeChange, onThemeChange, automatic = false, themeOnly = false }: {
  type: StampTypeFilter; theme: string; themes: string[];
  onTypeChange: (type: StampTypeFilter) => void; onThemeChange: (theme: string) => void;
  automatic?: boolean; themeOnly?: boolean;
}) {
  function chip(key: string, label: string, selected: boolean, onPress: () => void) {
    return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected }}
      accessibilityLabel={label} onPress={onPress} style={[styles.chip, selected && styles.selected]}>
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>;
  }
  return <View style={styles.container}>
    {!themeOnly ? <><Text style={styles.caption}>{automatic ? 'Standard: Sonderstempel erst bei näherem Zoom.' : 'Stempelart · Sonderstempel sind violett'}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {(automatic ? ['auto', 'all', 'regular', 'special'] as const : ['all', 'regular', 'special'] as const).map(key => chip(key,
        { auto: 'Standard', all: 'Alle Arten', regular: 'Regulär (1–222)', special: 'Sonderstempel' }[key],
        type === key, () => onTypeChange(key)))}
    </ScrollView></> : null}
    {themes.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chip('all-themes', 'Alle Themen', theme === '', () => onThemeChange(''))}
      {themes.map(key => chip(key, stampThemeLabels[key] || key, theme === key, () => onThemeChange(key)))}
    </ScrollView> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 8, marginVertical: 10 }, row: { gap: 8, paddingRight: 12 },
  caption: { color: '#695479', fontSize: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#ded6e8', borderRadius: 18, backgroundColor: '#faf8fd' },
  selected: { backgroundColor: SPECIAL_STAMP_COLOR, borderColor: SPECIAL_STAMP_COLOR },
  label: { color: '#4c3769', fontSize: 12, fontWeight: '600' }, selectedLabel: { color: '#fff' },
});
