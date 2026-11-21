import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignInRequiredScreen } from '@/components/auth-locked-state';
import { ThemeBookletsView } from '@/components/theme-booklets-view';
import { useThemeCatalogQuery } from '@/lib/queries';
import { useAuth } from '@/lib/auth';

export default function ThemeBookletsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data, isPending, error, refetch } = useThemeCatalogQuery();
  if (!isAuthenticated) return <SignInRequiredScreen title="Deine Themenhefte" body="Melde dich an, um deinen persönlichen Sammelfortschritt zu sehen." onSignIn={() => router.push('/login' as never)} />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#faf9f4' }} edges={['bottom']}>
    <Stack.Screen options={{ title: 'Themenhefte', headerShown: true }} />
    <ThemeBookletsView collections={data ?? []} loading={isPending} error={error?.message}
      onBadgePress={id => router.push(`/profile/badges/${id}` as never)}
      onStampPress={id => router.push(`/stamps/${id}` as never)} onRefresh={() => void refetch()} />
  </SafeAreaView>;
}
