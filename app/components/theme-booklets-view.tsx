import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ThemeCatalogItem } from '@/lib/api';

export function ThemeBookletsView({ collections, loading = false, error, onStampPress, onRefresh, onBadgePress }: {
  collections: ThemeCatalogItem[]; loading?: boolean; error?: string;
  onStampPress: (id: string) => void; onBadgePress?: (id: string) => void; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [missingOnly, setMissingOnly] = useState(false);
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Themenhefte & Themenwege</Text>
    <Text style={styles.body}>Entdecke die Stempel, die zu deinem Themenheft oder Wanderweg gehören. Ein Besuch zählt in allen zugeordneten Sammlungen.</Text>
    <Text style={styles.note}>Deine digitale Sammlung ersetzt den Nachweis im offiziellen Wanderpass und Begleitheft nicht.</Text>
    <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.secondary}><Text>Fortschritt aktualisieren</Text></Pressable>
    {loading ? <Text>Themenhefte werden geladen …</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!loading && !error && !collections.length ? <Text style={styles.body}>Es sind noch keine vollständig zugeordneten Themenhefte freigegeben.</Text> : null}
    {collections.map(collection => <View key={collection.ID} style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === collection.ID }} onPress={() => setExpanded(expanded === collection.ID ? null : collection.ID)}>
        <Text style={styles.heading}>{collection.name}</Text>
        <Text style={styles.note}>{collection.kind === 'trail' ? 'Themenweg' : 'Themenheft'} · Ausgabe {collection.edition}</Text>
        <Text style={styles.progress}>{collection.collectedCount} / {collection.expectedStampCount} Stempel gesammelt</Text>
        <Text style={styles.body}>{collection.complete ? 'Sammelziel erreicht' : 'Weiter sammeln'}</Text>
      </Pressable>
      {expanded === collection.ID ? <View style={styles.details}>
        {collection.badgeId && onBadgePress ? <Pressable accessibilityRole="button" onPress={() => onBadgePress(collection.badgeId!)}><Text style={styles.link}>Abzeichen im Album ansehen</Text></Pressable> : null}
        {collection.rulesNote ? <Text style={styles.body}>{collection.rulesNote}</Text> : null}
        <Text style={styles.body}>Pflichtstempel: {collection.requiredCollected} / {collection.requiredCount}</Text>
        {collection.minimumOptionalCount > 0 ? <Text style={styles.body}>Wahlstempel: {Math.min(collection.optionalCollected, collection.minimumOptionalCount)} / {collection.minimumOptionalCount}</Text> : null}
        {collection.regularVisitTarget > 0 ? <Text style={styles.body}>Reguläre HWN-Stempel: {collection.regularVisited} / {collection.regularVisitTarget}</Text> : null}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: missingOnly }} onPress={() => setMissingOnly(value => !value)} style={styles.secondary}>
          <Text>{missingOnly ? '✓ Nur fehlende Stempel' : 'Nur fehlende Stempel'}</Text>
        </Pressable>
        {collection.stamps.filter(stamp => !missingOnly || !stamp.visited).map(stamp => <Pressable key={stamp.stampId} accessibilityRole="button" onPress={() => onStampPress(stamp.stampId)} style={styles.stamp}>
          <Text style={styles.stampName}>{stamp.visited ? '✓' : '○'} {stamp.number} · {stamp.name}</Text>
          <Text style={styles.note}>{stamp.stampKind === 'special' ? 'Sonderstempel' : 'HWN-Stempel'} · {stamp.required ? 'Pflicht' : 'Wahl'}</Text>
        </Pressable>)}
        {missingOnly && collection.stamps.every(stamp => stamp.visited) ? <Text style={styles.body}>Alle zugeordneten Stempel gesammelt.</Text> : null}
        <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(collection.sourceUrl).catch(() => {}); }}><Text style={styles.link}>Offizielle Quelle und Bedingungen</Text></Pressable>
      </View> : null}
    </View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, gap: 16, backgroundColor: '#faf9f4' },
  title: { fontSize: 26, fontWeight: '700', color: '#203c2a' },
  heading: { fontSize: 20, fontWeight: '700', color: '#203c2a' },
  body: { fontSize: 14, lineHeight: 21, color: '#3f503f' },
  note: { fontSize: 12, lineHeight: 19, color: '#65715f' },
  card: { backgroundColor: '#edf2e7', padding: 18, borderRadius: 20 },
  details: { gap: 14, marginTop: 18 }, progress: { fontSize: 16, fontWeight: '700', color: '#2e6b4b', marginVertical: 10 },
  secondary: { backgroundColor: '#e4eadc', borderRadius: 12, padding: 12 },
  stamp: { borderTopWidth: 1, borderTopColor: '#d3ddca', paddingVertical: 10, gap: 4 },
  stampName: { fontSize: 14, color: '#203c2a', fontWeight: '600' },
  link: { color: '#2e6b4b', textDecorationLine: 'underline', fontSize: 13 }, error: { color: '#a13932' },
});
