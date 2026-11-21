import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Stampbox } from '@/lib/api';
import { isSpecialStamp, stampThemes, stampThemeLabels } from '@/lib/stamp-catalog';

export function StampCatalogInfo({ stamp }: { stamp: Stampbox }) {
  if (!isSpecialStamp(stamp)) return null;
  const themes = stampThemes(stamp);
  return <View style={styles.card}>
    <Text style={styles.title}>Sonderstempel · zählt getrennt von den 222 regulären Stellen</Text>
    {themes.length ? <Text style={styles.body}>{themes.map(key => stampThemeLabels[key] || key).join(' · ')}</Text> : null}
    {stamp.identityStatus === 'unverified' ? <Text style={styles.body}>Die genaue Stempelidentität ist noch ungeklärt.</Text> : null}
    {stamp.locationStatus === 'mobile' ? <Text style={styles.body}>Mobiler Zugstempel, ohne festen Kartenstandort.</Text>
      : stamp.locationStatus === 'unverified' ? <Text style={styles.body}>Standortkoordinaten sind noch nicht bestätigt.</Text> : null}
    {stamp.availability === 'withdrawn' ? <Text style={styles.body}>Laut offizieller Meldung entfallen. Frühere Besuche bleiben erhalten.</Text> : null}
    {stamp.sourceUrl?.startsWith('https://www.harzer-wandernadel.de/') ? <Pressable
      accessibilityRole="link" onPress={() => void Linking.openURL(stamp.sourceUrl!)}>
      <Text style={styles.link}>Offizielle Quelle · geprüft am {stamp.sourceCheckedAt || 'unbekannt'}</Text>
    </Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#f2edf8', borderRadius: 14, padding: 14, gap: 8 },
  title: { color: '#5b3285', fontWeight: '700', lineHeight: 21 },
  body: { color: '#5f5469', lineHeight: 21 }, link: { color: '#68458f', textDecorationLine: 'underline' },
});
