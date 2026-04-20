import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function WebAdminStampFallback() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin-Karte im Web nicht verfuegbar</Text>
      <Text style={styles.body}>
        Das Bearbeiten von Stempeln mit Karte ist aktuell nur in der mobilen App verfuegbar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
  },
});
