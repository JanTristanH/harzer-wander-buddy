import React from 'react';
import { Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/lib/connectivity';

export function OfflineBanner() {
  const { isAuthenticated, sessionMode } = useAuth();
  const { isOffline } = useConnectivity();
  const insets = useSafeAreaInsets();

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0
  );

  if (!isAuthenticated || !isOffline) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.container, { top: topInset + 8 }]}>
      <View style={styles.badge}>
        <Text style={styles.text}>
          {sessionMode === 'offline_grace'
            ? 'Offline-Modus: Lokale Daten, Schreiben deaktiviert'
            : 'Offline: Lokale Daten, Schreiben deaktiviert'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 999,
  },
  badge: {
    backgroundColor: 'rgba(35, 53, 79, 0.92)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    color: '#F5F3EE',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
