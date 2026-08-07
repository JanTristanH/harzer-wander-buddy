import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FriendAvatar } from '@/components/friends-list';

export function GroupMemberStatusAvatar({
  accessible = true,
  accessibilityName,
  image,
  index,
  name,
  size = 32,
  testID,
  visited,
}: {
  accessible?: boolean;
  accessibilityName?: string;
  image?: string;
  index: number;
  name: string;
  size?: number;
  testID?: string;
  visited: boolean;
}) {
  return (
    <View
      accessibilityLabel={
        accessible ? `${accessibilityName ?? name}: ${visited ? 'besucht' : 'unbesucht'}` : undefined
      }
      accessible={accessible}
      style={{ height: size, width: size }}
      testID={testID}>
      <FriendAvatar
        image={image}
        index={index}
        name={name}
        radius={size / 2}
        size={size}
        testID={testID ? `${testID}-image` : undefined}
      />
      <View
        style={[
          styles.statusBadge,
          visited ? styles.statusBadgeVisited : styles.statusBadgeOpen,
        ]}>
        <Feather
          color={visited ? '#f5f3ee' : '#7a6a4a'}
          name={visited ? 'check' : 'x'}
          size={8}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    alignItems: 'center',
    borderColor: '#ffffff',
    borderRadius: 7,
    borderWidth: 1.5,
    bottom: -2,
    height: 13,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 13,
  },
  statusBadgeVisited: {
    backgroundColor: '#2e6b4b',
  },
  statusBadgeOpen: {
    backgroundColor: '#ddd2bd',
  },
});
