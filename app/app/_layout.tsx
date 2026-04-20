import {
  focusManager,
  useQueryClient,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { OfflineBanner } from '@/components/offline-banner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth, useIdTokenClaims } from '@/lib/auth';
import { ConnectivityProvider, configureQueryOnlineManager, useConnectivity } from '@/lib/connectivity';
import { runCoreOfflineSync } from '@/lib/core-offline-sync';
import { queryPersistOptions } from '@/lib/query-persistence';
import { queryClient } from '@/lib/query-client';

function QueryFocusBridge() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}

function CoreOfflineSyncBridge() {
  const queryClient = useQueryClient();
  const { accessToken, currentUserProfile, isAuthenticated } = useAuth();
  const { isOnline } = useConnectivity();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const syncSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !isOnline) {
      return;
    }

    const signature = `${claims?.sub ?? 'anonymous'}:${accessToken.slice(-10)}`;
    if (syncSignatureRef.current === signature) {
      return;
    }

    syncSignatureRef.current = signature;

    void runCoreOfflineSync({
      queryClient,
      accessToken,
      userId: claims?.sub,
      currentUserProfile:
        claims?.sub && currentUserProfile?.id === claims.sub
          ? {
              id: currentUserProfile.id,
              name: currentUserProfile.name,
              picture: currentUserProfile.picture,
            }
          : null,
    }).catch((error) => {
      syncSignatureRef.current = null;
      console.warn('Failed to run core offline sync', error);
    });
  }, [accessToken, claims?.sub, currentUserProfile, isAuthenticated, isOnline, queryClient]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    configureQueryOnlineManager();
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={queryPersistOptions}>
      <ConnectivityProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="profile/edit" />
                <Stack.Screen name="profile/[userId]" />
                <Stack.Screen name="profile/timeline/[userId]" />
                <Stack.Screen name="tours/[id]/index" />
                <Stack.Screen name="tours/[id]/edit" />
                <Stack.Screen name="stamps/[id]" />
                <Stack.Screen name="parking/[id]" />
                <Stack.Screen name="admin/index" />
                <Stack.Screen name="admin/stamps/index" />
                <Stack.Screen name="admin/stamps/[id]" />
                <Stack.Screen name="admin/parking/index" />
                <Stack.Screen name="admin/parking/[id]" />
              </Stack>
              <StatusBar style="light" />
            </ThemeProvider>
            <QueryFocusBridge />
            <CoreOfflineSyncBridge />
            <OfflineBanner />
          </AuthProvider>
        </GestureHandlerRootView>
      </ConnectivityProvider>
    </PersistQueryClientProvider>
  );
}
