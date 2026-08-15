import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

const AVATAR_COLORS = ['#DDE9DF', '#EADFCB', '#D7E2EC', '#E6D9E9'];

export type FriendsListItem = {
  id: string;
  name: string;
  subtitle?: string;
  image?: string;
  onPress?: () => void;
  actionLabel?: string;
  actionMuted?: boolean;
  actionDisabled?: boolean;
  onActionPress?: () => void;
};

export function FriendAvatar({
  image,
  index,
  name,
  size = 44,
  radius = 16,
  testID,
}: {
  image?: string;
  index: number;
  name?: string;
  size?: number;
  radius?: number;
  testID?: string;
}) {
  const { accessToken } = useAuth();
  const avatarStyle = {
    borderRadius: radius,
    height: size,
    width: size,
  } as const;

  if (image) {
    return (
      <Image
        cachePolicy="disk"
        contentFit="cover"
        source={buildAuthenticatedImageSource(image, accessToken)}
        style={[avatarStyle, styles.avatarImage]}
        testID={testID}
      />
    );
  }

  const initials = name
    ?.trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <View
      style={[
        avatarStyle,
        styles.avatarFallback,
        { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
      ]}
      testID={testID}>
      {initials ? (
        <Text style={[styles.avatarFallbackLabel, { fontSize: Math.max(9, size * 0.28) }]}>
          {initials}
        </Text>
      ) : null}
    </View>
  );
}

function FriendsListRow({
  item,
  index,
}: {
  item: FriendsListItem;
  index: number;
}) {
  return (
    <View style={styles.friendCard}>
      <Pressable
        disabled={!item.onPress}
        onPress={item.onPress}
        style={({ pressed }) => [styles.friendRowPressable, pressed && item.onPress && styles.pressed]}>
        <FriendAvatar image={item.image} index={index} name={item.name} />
        <View style={styles.friendBody}>
          <Text style={styles.friendName}>{item.name}</Text>
          {item.subtitle ? <Text style={styles.friendMeta}>{item.subtitle}</Text> : null}
        </View>
      </Pressable>
      {item.actionLabel && item.onActionPress ? (
        <Pressable
          disabled={item.actionDisabled}
          onPress={item.onActionPress}
          style={({ pressed }) => [
            styles.inlineActionButton,
            item.actionMuted && styles.inlineActionButtonMuted,
            item.actionDisabled && styles.inlineActionButtonDisabled,
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.inlineActionLabel, item.actionMuted && styles.inlineActionLabelMuted]}>
            {item.actionLabel}
          </Text>
        </Pressable>
      ) : item.onPress ? (
        <Pressable hitSlop={8} onPress={item.onPress} style={({ pressed }) => [styles.chevronButton, pressed && styles.pressed]}>
          <Feather color="#2E6B4B" name="chevron-right" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FriendsList({ items }: { items: FriendsListItem[] }) {
  return (
    <View style={styles.cardsColumn}>
      {items.map((item, index) => (
        <FriendsListRow key={item.id} index={index} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cardsColumn: {
    gap: 16,
  },
  friendCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  friendRowPressable: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  avatarImage: {
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackLabel: {
    color: '#405044',
    fontFamily: Fonts.sans,
    fontWeight: '800',
  },
  friendBody: {
    flex: 1,
  },
  friendName: {
    color: '#1E2A1E',
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 2,
  },
  friendMeta: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  inlineActionButton: {
    backgroundColor: '#2E6B4B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineActionButtonMuted: {
    backgroundColor: '#E9E2D6',
  },
  inlineActionButtonDisabled: {
    opacity: 0.7,
  },
  inlineActionLabel: {
    color: '#F5F3EE',
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  inlineActionLabelMuted: {
    color: '#2E3A2E',
  },
  chevronButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 32,
  },
  pressed: {
    opacity: 0.88,
  },
});
