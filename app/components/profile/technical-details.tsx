import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useServerInfoQuery } from '@/lib/queries';

export function TechnicalDetails() {
  const [expanded, setExpanded] = useState(false);
  const { data: serverInfo, isFetching, isError } = useServerInfoQuery(expanded);
  const serverUnavailable = isFetching ? 'Wird geladen…' : 'Nicht verfügbar';
  const serverDate = serverInfo?.serverTime ? new Date(serverInfo.serverTime) : null;
  const serverTime =
    serverDate && Number.isFinite(serverDate.getTime())
      ? new Intl.DateTimeFormat('de-DE', {
          dateStyle: 'medium',
          timeStyle: 'long',
        }).format(serverDate)
      : serverUnavailable;
  const isWeb = Platform.OS === 'web';
  const unavailable = isWeb ? 'In der Web-App nicht verfügbar' : 'Nicht verfügbar';
  const rows = [
    ['Server-Version', (!isError && serverInfo?.version) || serverUnavailable],
    ['Server-Zeit (beim Abruf)', isError ? serverUnavailable : serverTime],
    [
      'App-Version',
      (!isWeb && Constants.nativeAppVersion) || Constants.expoConfig?.version || 'Nicht verfügbar',
    ],
    ['Build-Nummer', (!isWeb && Constants.nativeBuildVersion) || unavailable],
    ['Expo-Runtime-Version', (!isWeb && Updates.runtimeVersion) || unavailable],
    [
      'Update-Channel',
      (!isWeb && Updates.channel) || (isWeb ? unavailable : 'Kein Channel konfiguriert'),
    ],
    ['Update-ID', (!isWeb && Updates.updateId) || unavailable],
    [
      'Update-Quelle',
      isWeb
        ? 'Web-App'
        : !Updates.isEnabled
          ? 'Entwicklungsmodus / Updates deaktiviert'
          : Updates.isEmbeddedLaunch
            ? 'Im Build enthalten'
            : 'Expo Update',
    ],
  ];

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <Feather color="#6b7a6b" name="info" size={18} />
        <Text style={styles.title}>Technische Details</Text>
        <Feather color="#6b7a6b" name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text selectable style={styles.value}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  trigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  details: { paddingBottom: 8, gap: 12 },
  row: { gap: 3 },
  label: { color: '#6b7a6b', fontSize: 12, lineHeight: 16 },
  value: { color: '#1e2a1e', fontSize: 14, lineHeight: 20, flexShrink: 1 },
  pressed: { opacity: 0.84 },
});
