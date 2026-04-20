import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

const bearIllustration = require('@/assets/images/onboarding-bear.png');

type ActionButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
};

function ActionButton({
  label,
  variant = 'secondary',
  disabled,
  style,
  ...props
}: ActionButtonProps) {
  const resolveStyle = (state: PressableStateCallbackType) =>
    typeof style === 'function' ? style(state) : style;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.actionButton,
        variant === 'primary' ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        disabled && styles.actionButtonDisabled,
        state.pressed && !disabled && styles.actionButtonPressed,
        resolveStyle(state),
      ]}
      {...props}>
      <Text
        style={[
          styles.actionButtonLabel,
          variant === 'primary' ? styles.actionButtonLabelPrimary : styles.actionButtonLabelSecondary,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function LoginScreen() {
  const { authError, configError, hasCompletedOnboarding, isAuthenticated, isLoading, login, signup } =
    useAuth();

  if (isAuthenticated && !isLoading) {
    return <Redirect href={(hasCompletedOnboarding ? '/(tabs)' : '/onboarding') as never} />;
  }

  const errorMessage = configError || authError;

  return (
    <LinearGradient colors={['#f7f5ef', '#f1eee5', '#ece7dc']} style={styles.gradient}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>Login</Text>

          <View style={styles.heroCard}>
            <View style={styles.heroTextColumn}>
              <Text style={styles.title}>Zurueck auf den Harzer Weg</Text>
              <Text style={styles.copy}>
                Melde dich an und spring direkt zu deinen Stempelstellen, Freunden und Profilen.
              </Text>
            </View>
            <Image contentFit="contain" source={bearIllustration} style={styles.heroImage} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Konto</Text>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={styles.buttonColumn}>
              <ActionButton
                disabled={!!configError || isLoading}
                label={isLoading ? 'Wird vorbereitet...' : 'Anmelden'}
                onPress={login}
                variant="primary"
              />
              <ActionButton
                disabled={!!configError || isLoading}
                label={isLoading ? 'Wird vorbereitet...' : 'Konto erstellen'}
                onPress={signup}
              />
            </View>
          </View>

          {!hasCompletedOnboarding ? (
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Neu hier?</Text>
              <Text style={styles.noteCopy}>
                Schau dir zuerst das Onboarding mit Standortfreigabe und Freundesuche an.
              </Text>
              <Link href="/onboarding" style={styles.noteLink}>
                Zum Onboarding
              </Link>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: '100%',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#61705f',
    fontSize: 12,
    letterSpacing: 2.2,
    lineHeight: 16,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTextColumn: {
    flex: 1,
    gap: 10,
  },
  title: {
    color: '#11100d',
    fontSize: 28,
    lineHeight: 36,
    fontFamily: Fonts.serif,
  },
  copy: {
    color: '#5a6655',
    fontSize: 14,
    lineHeight: 21,
  },
  heroImage: {
    width: 120,
    height: 120,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 20,
    gap: 14,
    shadowColor: '#bda981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 5,
  },
  cardTitle: {
    color: '#263127',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  cardCopy: {
    color: '#778177',
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: '#8a2d1f',
    fontSize: 12,
    lineHeight: 18,
  },
  buttonColumn: {
    gap: 12,
  },
  actionButton: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#397b52',
  },
  actionButtonSecondary: {
    backgroundColor: '#e8dfcf',
  },
  actionButtonDisabled: {
    opacity: 0.48,
  },
  actionButtonPressed: {
    opacity: 0.88,
  },
  actionButtonLabel: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  actionButtonLabelPrimary: {
    color: '#f5f3ee',
  },
  actionButtonLabelSecondary: {
    color: '#374337',
  },
  noteCard: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(233, 226, 214, 0.86)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  noteTitle: {
    color: '#263127',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  noteCopy: {
    color: '#5a6655',
    fontSize: 12,
    lineHeight: 18,
  },
  noteLink: {
    color: '#2f6d49',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
