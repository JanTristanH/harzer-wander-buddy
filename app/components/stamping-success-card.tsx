import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StampingFeedback } from '@/lib/stamping-feedback';
import { BadgeArtwork } from './badge-artwork';

export function StampingSuccessCard({ feedback, friendVisitCount = 0, savedVisitCount = 0, onClose, onAlbum }: {
  feedback: StampingFeedback | null;
  friendVisitCount?: number;
  savedVisitCount?: number;
  onClose(): void;
  onAlbum(): void;
}) {
  const { height } = useWindowDimensions();
  const badge = feedback?.newBadges[0];
  const title = badge ? `${badge.name} freigeschaltet!`
    : feedback?.newPlaces ? feedback.places.length === 1 ? `${feedback.places[0]} gesammelt!` : 'Deine Sammlung wächst!'
      : feedback?.visitCount ? 'Besuch festgehalten'
        : savedVisitCount ? 'Besuche gespeichert' : 'Gruppenbesuche gespeichert';
  return <View style={styles.card} testID="stamping-success-card">
    <View style={styles.header}>
      <View style={styles.heading}>
        <Feather name={badge ? 'award' : 'check-circle'} size={22} color="#2e6b4b" />
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{title}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Erfolg schließen" onPress={onClose} style={styles.close}>
        <Feather name="x" size={22} color="#2e6b4b" />
      </Pressable>
    </View>
    <ScrollView style={{ maxHeight: height * 0.4 }} contentContainerStyle={styles.body}>
      {badge ? <View style={styles.milestone}>
        <BadgeArtwork entry={badge} size={64} />
        <Image source={require('@/assets/images/buddy/stamp-success-badge.png')} contentFit="contain" style={{ width: 64, height: 64 }} accessible={false} />
      </View> : null}
      {feedback?.visitCount ? <>
        <Text style={styles.progress}>{feedback.beforeCount} → {feedback.afterCount} reguläre Stempel</Text>
        <Text style={styles.text}>
          {feedback.newPlaces ? `${feedback.newPlaces} neue ${feedback.newPlaces === 1 ? 'Stempelstelle' : 'Stempelstellen'}. ` : ''}
          {feedback.repeatCount ? `${feedback.repeatCount} ${feedback.repeatCount === 1 ? 'Wiederholungsbesuch' : 'Wiederholungsbesuche'}.` : ''}
        </Text>
        {!feedback.newPlaces && feedback.visitedAt ? <Text style={styles.text}>
          {new Date(feedback.visitedAt).toLocaleDateString('de-DE')}
        </Text> : null}
        {feedback.newBadges.length ? <Text style={styles.text}>
          Neu im digitalen Album: {feedback.newBadges.map(entry => entry.name).join(', ')}.
        </Text> : feedback.nextGoal ? <Text style={styles.text}>
          Nächstes Ziel: {feedback.nextGoal.name} · {feedback.nextGoal.progress.map(part => `${part.current}/${part.total} ${part.label}`).join(' · ')}
        </Text> : <Text style={styles.text}>Alle digitalen Sammelziele erreicht.</Text>}
      </> : null}
      {!feedback && savedVisitCount > 0 ? <Text style={styles.text}>
        {savedVisitCount} {savedVisitCount === 1 ? 'Besuch bestätigt.' : 'Besuche bestätigt.'}
      </Text> : null}
      {friendVisitCount > 0 ? <Text style={styles.text}>
        {feedback?.visitCount || savedVisitCount ? 'Zusätzlich ' : ''}{friendVisitCount} {friendVisitCount === 1 ? 'Besuch für einen Freund' : 'Besuche für Freunde'} gespeichert.
      </Text> : null}
      <View style={styles.actions}>
        {badge ? <Pressable accessibilityRole="button" onPress={onAlbum} style={styles.primary}>
          <Text style={styles.primaryText}>Abzeichen ansehen</Text>
        </Pressable> : null}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
          <Text style={styles.secondaryText}>Weiter entdecken</Text>
        </Pressable>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: '#f2f6e9', borderColor: '#b9c9a8', borderWidth: 1, borderRadius: 20, padding: 12, elevation: 12, boxShadow: '0 8px 28px rgba(22,42,25,0.18)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  title: { flex: 1, color: '#214d36', fontSize: 18, lineHeight: 24, fontWeight: '700' },
  close: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  progress: { color: '#214d36', fontSize: 17, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  text: { color: '#3c513d', fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: '#2e6b4b', paddingHorizontal: 14, justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondary: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
  secondaryText: { color: '#214d36', fontSize: 14, fontWeight: '600' },
});
