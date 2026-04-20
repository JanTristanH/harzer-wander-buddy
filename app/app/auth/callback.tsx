import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { completeWebRedirectAuth } = useAuth();

  useEffect(() => {
    let isMounted = true;

    async function finalizeAuth() {
      if (Platform.OS === 'web') {
        await completeWebRedirectAuth();
      }

      if (!isMounted) {
        return;
      }

      router.replace('/');
    }

    void finalizeAuth();

    return () => {
      isMounted = false;
    };
  }, [completeWebRedirectAuth, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
