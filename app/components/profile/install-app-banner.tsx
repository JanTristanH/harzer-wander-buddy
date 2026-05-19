import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const ANDROID_APP_INSTALL_URL =
  'https://drive.google.com/drive/folders/1nP3ASQriXBceI7KxaNph6jSPwPgcKXBy';

const appIcon = require('@/assets/images/icon.png');

function isAndroidWebBrowser() {
  if (Platform.OS !== 'web' || typeof globalThis.navigator?.userAgent !== 'string') {
    return false;
  }

  return /android/i.test(globalThis.navigator.userAgent);
}

export function InstallAppBanner({ visible }: { visible?: boolean }) {
  if (!visible || !isAndroidWebBrowser()) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(ANDROID_APP_INSTALL_URL)}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
      <Image contentFit="cover" source={appIcon} style={styles.icon} />
      <View style={styles.copy}>
        <Text style={styles.title}>App installieren</Text>
        <Text style={styles.body}>Nutze die Android-App fuer die beste Erfahrung.</Text>
      </View>
      <View style={styles.cta}>
        <Feather color="#f5f3ee" name="external-link" size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: '#2e6b4b',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f5f3ee',
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    minWidth: 1,
    gap: 3,
  },
  title: {
    color: '#f5f3ee',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  body: {
    color: '#dfe9dd',
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(245, 243, 238, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.72,
  },
});
