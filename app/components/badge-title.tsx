import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function BadgeTitle({ title }: { title?: string }) {
  if (!title) return null;
  return <View style={styles.badge}><Text style={styles.label}>{title}</Text></View>;
}
const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#e8eee2',
    borderColor: '#c4d4bd', borderWidth: 1,
  },
  label: { color: '#2e6b4b', fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
