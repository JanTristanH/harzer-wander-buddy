import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useAdminAccess } from '@/lib/auth';
import { fetchContentReports, moderateReportedUser } from '@/lib/api';

export default function ModerationScreen() {
  const { getValidAccessToken, isOffline } = useAuth();
  const { isAdmin } = useAdminAccess();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchContentReports>>>([]);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isAdmin || isOffline) return;
    void getValidAccessToken().then(token => token ? fetchContentReports(token) : [])
      .then(setRows).catch(error => setMessage(String(error)));
  }, [getValidAccessToken, isAdmin, isOffline]);
  async function moderate(id: string) {
    setBusy(true);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Bitte erneut anmelden.');
      setMessage(await moderateReportedUser(token, id));
      setRows(await fetchContentReports(token)); setSelected('');
    } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Link href={'/admin' as never}>Zur Administration</Link>
    <Text accessibilityRole="header" style={{ fontSize: 24 }}>Inhaltsmeldungen</Text>
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    {!isAdmin ? <Text>Administratorzugang erforderlich.</Text> : rows.map(row => <View key={row.ID} style={{ padding: 16, gap: 12, borderWidth: 1, borderColor: '#ddd' }}>
      <Text>{row.status} · {row.targetUser}</Text><Text selectable>{row.reason}</Text>
      <Link href={`/profile/${encodeURIComponent(row.targetUser)}` as never}>Profil prüfen</Link>
      {row.status === 'open' ? <Pressable accessibilityRole="button" disabled={busy || isOffline} onPress={() => selected === row.ID ? void moderate(row.ID) : setSelected(row.ID)}>
        <Text>{selected === row.ID ? 'Bestätigen: Bild und Namen entfernen, Veröffentlichungen sperren' : 'Nach Prüfung Inhalte entfernen'}</Text>
      </Pressable> : null}
    </View>)}
  </ScrollView></SafeAreaView>;
}
