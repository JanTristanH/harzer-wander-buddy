import { Link, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LegalLinks } from '@/components/legal-links';
import { appConfig } from '@/lib/config';

type LegalContent = { ready: boolean; documents: Record<string, { title: string; text: string }> };
export default function LegalScreen() {
  const { document } = useLocalSearchParams<{ document: string }>();
  const [content, setContent] = useState<LegalContent | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setContent(null); setError('');
    void fetch(`${appConfig.backendUrl.replace(/\/$/, '')}/legal/content`)
      .then(async response => {
        if (!response.ok) throw new Error('Rechtstexte konnten nicht geladen werden. Bitte prüfe deine Verbindung.');
        return response.json() as Promise<LegalContent>;
      }).then(data => { if (active) setContent(data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.'); });
    return () => { active = false; };
  }, [document]);
  const doc = content?.documents[document];
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f5ef' }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 18, maxWidth: 800, width: '100%', alignSelf: 'center' }}>
      <Link href={'/(tabs)/profile' as never}>Zur App</Link>
      {error ? <Text accessibilityRole="alert">{error}</Text> : !content ? <ActivityIndicator /> : null}
      {content && !doc ? <Text>Dieser Rechtstext ist nicht verfügbar.</Text> : null}
      {doc ? <View style={{ gap: 18 }}>
        <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '700', color: '#263127' }}>{doc.title}</Text>
        {!content?.ready && document === 'privacy' ? <Text accessibilityRole="alert">Entwurf: Betriebsangaben noch unvollständig.</Text> : null}
        <Text selectable style={{ fontSize: 16, lineHeight: 25, color: '#263127' }}>{doc.text}</Text>
      </View> : null}
      <LegalLinks />
    </ScrollView>
  </SafeAreaView>;
}
