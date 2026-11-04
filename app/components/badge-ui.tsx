import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import type { BadgeEntry } from '@/lib/badge-types';

export const badgeStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f3ee' },
  content: {
    padding: 20,
    gap: 18,
    maxWidth: 650,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: {
    fontSize: 28,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: '#20291f',
  },
  heading: {
    fontSize: 21,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: '#20291f',
  },
  text: { fontSize: 15, lineHeight: 22, color: '#4c5a50' },
  card: { padding: 18, borderRadius: 20, backgroundColor: '#fff', gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#2e6b4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c3cfc3',
  },
  secondaryText: { color: '#2e6b4b' },
  chip: {
    borderRadius: 22,
    backgroundColor: '#eceae2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  selected: { backgroundColor: '#e3e6df' },
  status: {
    alignSelf: 'center',
    borderRadius: 20,
    backgroundColor: '#e8f0e7',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  mutedStatus: { backgroundColor: '#eae9e3' },
  notice: { backgroundColor: '#eee8d6', padding: 14, borderRadius: 14 },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  center: { alignItems: 'center', gap: 14 },
});
export function BadgeButton({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        badgeStyles.button,
        secondary && badgeStyles.secondary,
        { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text
        style={[badgeStyles.buttonText, secondary && badgeStyles.secondaryText]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function BadgePage({
  title,
  children,
  footer,
}: React.PropsWithChildren<{ title: string; footer?: React.ReactNode }>) {
  const router = useRouter();
  const { isOffline } = useAuth();
  return (
    <SafeAreaView style={badgeStyles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={badgeStyles.content}
      >
        <View style={badgeStyles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/(tabs)/profile')
            }
            style={{ padding: 12, minHeight: 44, minWidth: 44 }}
          >
            <Feather name="arrow-left" size={22} color="#2e6b4b" />
          </Pressable>
          <Text style={[badgeStyles.title, { flex: 1 }]}>{title}</Text>
        </View>
        {isOffline ? (
          <Text style={[badgeStyles.text, badgeStyles.notice]}>
            Offline · Gespeicherter Stand. Änderungen sind wieder online
            möglich.
          </Text>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 16,
            borderTopWidth: 1,
            borderTopColor: '#e1e4d8',
          }}
        >
          <View
            style={{
              maxWidth: 610,
              width: '100%',
              alignSelf: 'center',
              gap: 10,
            }}
          >
            {footer}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
export function BadgeLoadState({
  error,
  retry,
}: {
  error?: unknown;
  retry: () => void;
}) {
  const { isOffline } = useAuth();
  return (
    <View style={badgeStyles.card}>
      {isOffline ? (
        <Text style={badgeStyles.text}>
          Für dieses Album ist noch kein Offline-Stand gespeichert. Öffne es
          einmal online.
        </Text>
      ) : error ? (
        <>
          <Text style={badgeStyles.text}>
            Das Abzeichenalbum konnte nicht geladen werden.
          </Text>
          <BadgeButton onPress={retry}>Erneut versuchen</BadgeButton>
        </>
      ) : (
        <>
          <ActivityIndicator color="#2e6b4b" />
          <Text style={badgeStyles.text}>Deine Abzeichen werden geladen …</Text>
        </>
      )}
    </View>
  );
}
export function BadgeProgress({
  entry,
  compact = false,
}: {
  entry: BadgeEntry;
  compact?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      {entry.progress.map((progress) => (
        <View
          key={progress.label}
          accessible
          accessibilityLabel={`${progress.label}: ${progress.current} von ${progress.total}`}
          style={{ gap: 5 }}
        >
          <Text
            style={[
              badgeStyles.text,
              compact && { fontSize: 13, lineHeight: 18, textAlign: 'center' },
            ]}
          >
            {compact
              ? `${progress.current} / ${progress.total} ${progress.label === 'Gesamtstempel' ? 'Stempel' : progress.label === 'Bergbau-Pflichtstellen' ? 'Bergbau' : 'Pflichtstellen'}`
              : `${progress.label} · ${progress.current} / ${progress.total}`}
          </Text>
          <View
            style={{
              height: 7,
              backgroundColor: '#e6e5dd',
              borderRadius: 5,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 7,
                width: `${Math.min(100, (progress.current / progress.total) * 100)}%`,
                backgroundColor: '#2e6b4b',
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
