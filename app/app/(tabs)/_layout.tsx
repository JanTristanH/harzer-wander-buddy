import { Design } from '@/constants/theme';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingBarIcon } from '@/components/floating-bar-icon';
import { HapticTab } from '@/components/haptic-tab';
import { getTabBarBottomMargin } from '@/lib/tab-bar-layout';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barWidth = Math.min(width - 32, 600);
  const tabBarBottomMargin = getTabBarBottomMargin(insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: Design.color.brand,
        tabBarInactiveTintColor: Design.color.muted,
        tabBarStyle: {
          backgroundColor: Design.color.surface,
          borderTopWidth: 0,
          height: 72,
          paddingTop: 6,
          paddingBottom: 6,
          ...(Platform.OS === 'web'
            ? { left: 16, right: 16, maxWidth: 600, marginHorizontal: 'auto' as const }
            : { width: barWidth, marginHorizontal: (width - barWidth) / 2 }),
          marginBottom: tabBarBottomMargin,
          borderRadius: 24,
          position: 'absolute',
          shadowColor: '#141e14',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
          elevation: 6,
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Stempel',
          tabBarIcon: ({ color, focused }) => (
            <FloatingBarIcon color={color} focused={focused} name="index" size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Karte',
          tabBarIcon: ({ color, focused }) => (
            <FloatingBarIcon color={color} focused={focused} name="map" size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="tours"
        options={{
          title: 'Touren',
          tabBarIcon: ({ color, focused }) => (
            <FloatingBarIcon color={color} focused={focused} name="tours" size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Freunde',
          tabBarIcon: ({ color, focused }) => (
            <FloatingBarIcon color={color} focused={focused} name="friends" size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <FloatingBarIcon color={color} focused={focused} name="profile" size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
