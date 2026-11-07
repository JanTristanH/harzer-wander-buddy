import { Link } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export function LegalLinks() {
  return <View style={styles.links}>
    <Link href={'/legal/imprint' as never} style={styles.link}>Impressum</Link>
    <Link href={'/legal/privacy' as never} style={styles.link}>Datenschutz</Link>
    <Link href={'/legal/terms' as never} style={styles.link}>Nutzungshinweise</Link>
    <Link href={'/account-privacy' as never} style={styles.link}>Konto und Datenschutz</Link>
  </View>;
}
const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 18 },
  link: { color: '#25643c', fontSize: 14, textDecorationLine: 'underline', paddingVertical: 8 },
});
