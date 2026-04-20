import { Redirect } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SkeletonBlock } from '@/components/skeleton';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: React.PropsWithChildren) {
  const { configError, hasCompletedOnboarding, isAuthenticated, isLoading } = useAuth();

  if (configError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.eyebrow}>Configuration</Text>
        <Text style={styles.errorText}>{configError}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingCard}>
          <SkeletonBlock height={16} radius={8} tone="strong" width="38%" />
          <SkeletonBlock height={42} radius={14} width="100%" />
          <SkeletonBlock height={14} radius={7} width="72%" />
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={(hasCompletedOnboarding ? '/login' : '/onboarding') as never} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f4efe4',
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#7a5f34',
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#3d2a15',
  },
  loadingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
});
