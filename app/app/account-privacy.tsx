import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LegalLinks } from '@/components/legal-links';
import { deleteMyAccount, exportMyData } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AccountPrivacyScreen() {
  const { isAuthenticated, isOffline, getValidAccessToken, logout } = useAuth();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function run(action: 'export' | 'delete') {
    if (busy || isOffline) return;
    setBusy(true); setMessage('');
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Bitte melde dich erneut an.');
      if (action === 'delete') {
        const result = await deleteMyAccount(token);
        // Local logout also clears tokens and persisted personal query data.
        await logout();
        setConfirmation(''); setMessage(result);
      } else {
        const json = await exportMyData(token);
        if (Platform.OS === 'web') {
          const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url; a.download = 'harzer-wanderbuddy-meine-daten.json';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          await Share.share({ title: 'Harzer Wanderbuddy – meine Daten', message: json });
        }
        setMessage('Deine Kontodaten wurden exportiert. Der Export kann persönliche Daten enthalten.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Die Aktion ist fehlgeschlagen. Bitte versuche es erneut.');
    } finally { setBusy(false); }
  }
  const disabled = busy || isOffline;
  return <SafeAreaView style={styles.page}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/profile' as never)}><Text style={styles.link}>Zur App</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Konto und Datenschutz</Text>
      <Text style={styles.text}>Du kannst deine Kontodaten exportieren oder dein Konto mit den zugehörigen App-Daten endgültig löschen.</Text>
      {message ? <Text accessibilityRole="alert" selectable style={styles.text}>{message}</Text> : null}
      {!isAuthenticated ? <Link href="/login" style={styles.link}>Anmelden, um dein Konto zu verwalten</Link> : <>
        <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={() => void run('export')}>
          <Text style={styles.buttonText}>Meine Daten exportieren</Text>
        </Pressable>
        <Link href={'/profile/edit' as never} style={styles.link}>Profil berichtigen</Link>
        <Text accessibilityRole="header" style={styles.title}>Konto endgültig löschen</Text>
        <Text style={styles.text}>Dabei werden dein Profil, hochgeladene Bilder, Stempelbesuche, Notizen, Touren, Freundschaften und Anfragen gelöscht. Die Löschung des Anmeldekontos wird automatisch verarbeitet und bei einem Dienstausfall erneut versucht. Das lässt sich nicht rückgängig machen. Exportiere deine Daten vorher, wenn du sie behalten möchtest.</Text>
        <Text style={styles.text}>Gib zur Bestätigung LÖSCHEN ein. Weitere Informationen zu Sicherungskopien und Löschfristen findest du in der Datenschutzerklärung.</Text>
        <TextInput accessibilityLabel="Bestätigung der Kontolöschung" autoCapitalize="characters" autoCorrect={false} value={confirmation} onChangeText={setConfirmation} editable={!busy} placeholder="LÖSCHEN" style={styles.input} />
        <Pressable accessibilityRole="button" disabled={disabled || confirmation !== 'LÖSCHEN'} style={[styles.button, styles.danger, (disabled || confirmation !== 'LÖSCHEN') && styles.disabled]} onPress={() => void run('delete')}>
          <Text style={styles.buttonText}>{busy ? 'Wird verarbeitet…' : 'Konto endgültig löschen'}</Text>
        </Pressable>
        {isOffline ? <Text style={styles.text}>Für Export und Löschung brauchst du eine Internetverbindung.</Text> : null}
      </>}
      <Text style={styles.text}>Für Auskunft, Berichtigung weiterer Daten, Einschränkung, Widerspruch, Widerruf oder bei verlorenem Kontozugang: info@harzer-wander-buddy.de. Bitte sende niemals dein Passwort.</Text>
      <Link href={'/community-safety' as never} style={styles.link}>Melden und Blockierungen verwalten</Link>
      <LegalLinks />
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f5ef' },
  content: { padding: 24, gap: 20, maxWidth: 800, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#263127' },
  text: { fontSize: 16, lineHeight: 24, color: '#263127' },
  link: { fontSize: 16, color: '#25643c', textDecorationLine: 'underline', paddingVertical: 8 },
  button: { padding: 16, borderRadius: 14, backgroundColor: '#397b52' },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 16 },
  danger: { backgroundColor: '#932f29' }, disabled: { opacity: 0.45 },
  input: { padding: 16, borderWidth: 1, borderColor: '#61705f', borderRadius: 12, fontSize: 16 },
});
