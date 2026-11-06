import { Link, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { blockUser, fetchMyBlocks, reportUser, unblockUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clearPersistedQueryCache } from '@/lib/query-persistence';

export default function CommunitySafetyScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const { isAuthenticated, isOffline, getValidAccessToken } = useAuth();
  const [target, setTarget] = useState(params.userId || '');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState<{ toUser: string }[]>([]);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isAuthenticated || isOffline) return;
    let active = true;
    void getValidAccessToken().then(token => token ? fetchMyBlocks(token) : [])
      .then(rows => { if (active) setBlocks(rows); }).catch(() => {});
    return () => { active = false; };
  }, [getValidAccessToken, isAuthenticated, isOffline]);
  async function run(action: 'report' | 'block' | 'unblock', id = target) {
    if (busy || isOffline) return;
    setBusy(true); setMessage('');
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Bitte melde dich an.');
      const result = action === 'report' ? await reportUser(token, id, reason) : action === 'block' ? await blockUser(token, id) : await unblockUser(token, id);
      if (action !== 'report') {
        await queryClient.cancelQueries(); queryClient.clear();
        await clearPersistedQueryCache();
      }
      setMessage(result); setBlocks(await fetchMyBlocks(token));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  function button(label: string, action: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" disabled={busy || isOffline || disabled} onPress={action} style={{ padding: 16, backgroundColor: '#e8dfcf', borderRadius: 12, opacity: busy || isOffline || disabled ? 0.5 : 1 }}><Text style={{ fontSize: 16 }}>{label}</Text></Pressable>;
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f5ef' }}><ScrollView contentContainerStyle={{ padding: 24, gap: 20, maxWidth: 800, alignSelf: 'center', width: '100%' }}>
    <Link href={'/(tabs)/profile' as never}>Zur App</Link>
    <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>Melden und Blockieren</Text>
    <Text style={{ fontSize: 16, lineHeight: 24 }}>Melde beleidigende, gefährliche oder rechtswidrige Profilbilder, Profil- oder Tourennamen. Beschreibe den Inhalt und nenne bei einer Tour die Tour-ID. Blockieren blendet das Profil und seine Touren aus, entfernt eure Freundschaft und verhindert neue Anfragen und gegenseitiges Stempeln.</Text>
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    {!isAuthenticated ? <Link href="/login">Zum Anmelden</Link> : <>
      <TextInput accessibilityLabel="Betroffene Nutzerkennung" value={target} onChangeText={setTarget} placeholder="Nutzerkennung" autoCapitalize="none" style={{ borderWidth: 1, borderColor: '#61705f', padding: 16, borderRadius: 12 }} />
      <TextInput accessibilityLabel="Grund der Meldung" value={reason} onChangeText={setReason} multiline maxLength={2000} placeholder="Inhalt und Grund der Meldung" style={{ borderWidth: 1, borderColor: '#61705f', padding: 16, borderRadius: 12, minHeight: 100 }} />
      {button('Inhalt melden', () => void run('report'), !target.trim() || !reason.trim())}
      {button('Profil blockieren', () => void run('block'), !target.trim())}
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700' }}>Deine Blockierungen</Text>
      {blocks.length === 0 ? <Text>Keine Blockierungen.</Text> : blocks.map(row => <View key={row.toUser} style={{ gap: 8 }}><Text>{row.toUser}</Text>{button('Blockierung aufheben', () => void run('unblock', row.toUser))}</View>)}
      {isOffline ? <Text>Für Meldungen und Blockierungen brauchst du eine Internetverbindung.</Text> : null}
    </>}
    <Text>Kontakt zum Betreiber: info@harzer-wander-buddy.de</Text>
  </ScrollView></SafeAreaView>;
}
