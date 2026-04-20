import { Redirect } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthGuard } from '@/components/auth-guard';
import { SkeletonBlock } from '@/components/skeleton';
import { useAdminAccess } from '@/lib/auth';

export function AdminGuard({ children }: React.PropsWithChildren) {
  const { isAdmin, isResolved } = useAdminAccess();

  return (
    <AuthGuard>
      {!isResolved ? (
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <SkeletonBlock height={16} radius={8} tone="strong" width="42%" />
            <SkeletonBlock height={42} radius={14} width="100%" />
            <SkeletonBlock height={14} radius={7} width="66%" />
          </View>
        </View>
      ) : isAdmin ? (
        <>{children}</>
      ) : (
        <Redirect href={'/(tabs)/profile' as never} />
      )}
    </AuthGuard>
  );
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
