import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Stampbox } from '@/lib/api';

export function StampRow({ stamp }: { stamp: Stampbox }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{stamp.number || '??'}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{stamp.name}</Text>
          <Text style={styles.meta}>
            {stamp.hasVisited ? 'Visited' : 'Open'} · Group {stamp.totalGroupStampings ?? 0}
          </Text>
        </View>
      </View>
      <Text numberOfLines={3} style={styles.description}>
        {stamp.description?.trim() || 'No description available yet.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fffaf0',
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#ead9b6',
    shadowColor: '#7a5f34',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#155e63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#f7f2e8',
    fontSize: 20,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#1e2a27',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  meta: {
    color: '#6b654f',
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    color: '#3f453f',
    fontSize: 15,
    lineHeight: 22,
  },
});
