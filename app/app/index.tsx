import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';

export default function IndexScreen() {
  const { hasCompletedOnboarding, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingShell}>
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#397b52" size="small" />
          <Text style={styles.loadingEyebrow}>Harzer Wander Buddy</Text>
          <Text style={styles.loadingCopy}>Startet und stellt deine Sitzung wieder her...</Text>
        </View>
      </View>
    );
  }

  return (
    <Redirect
      href={
        (
          isAuthenticated
            ? hasCompletedOnboarding
              ? '/(tabs)'
              : '/onboarding'
            : hasCompletedOnboarding
              ? '/login'
              : '/onboarding'
        ) as never
      }
    />
  );
}

const styles = StyleSheet.create({
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f4efe4',
  },
  loadingCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  loadingEyebrow: {
    color: '#2f6d49',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  loadingCopy: {
    color: '#4f5f52',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
