import { Feather } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FriendAvatar } from '@/components/friends-list';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useHikingGroup } from '@/lib/hiking-group';

export type GroupSelectorProps = {
  testID?: string;
};

export function GroupSelector({ testID = 'group-selector-button' }: GroupSelectorProps) {
  const { isAuthenticated } = useAuth();
  const {
    clearGroup,
    isLoading,
    members,
    selectedFriendIds,
    toggleFriend,
  } = useHikingGroup();
  const [isVisible, setIsVisible] = useState(false);

  const closeSelector = useCallback(() => {
    setIsVisible(false);
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  const selectionCount = selectedFriendIds.length;
  const buttonAccessibilityLabel =
    selectionCount === 0
      ? 'Wandergruppe auswählen'
      : `Wandergruppe auswählen, ${selectionCount} ${
          selectionCount === 1 ? 'Freund ausgewählt' : 'Freunde ausgewählt'
        }`;

  return (
    <>
      <Pressable
        accessibilityLabel={buttonAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: isVisible }}
        onPress={() => setIsVisible(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        testID={testID}>
        <Feather color="#2E6B4B" name="users" size={16} />
        <Text style={styles.triggerLabel}>Gruppe</Text>
        {selectionCount > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeLabel}>{selectionCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={closeSelector}
        transparent
        visible={isVisible}>
        <View style={styles.modalOverlay} testID="group-selector-modal">
          <Pressable
            accessibilityLabel="Gruppenauswahl schließen"
            onPress={closeSelector}
            style={styles.modalBackdrop}
            testID="group-selector-backdrop"
          />
          <View
            accessibilityViewIsModal
            style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Text style={styles.modalTitle}>Wandergruppe auswählen</Text>
                <Text style={styles.modalDescription}>
                  Wähle Freunde für gemeinsame Fortschritte aus. Du bist automatisch dabei.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Gruppenauswahl schließen"
                accessibilityRole="button"
                onPress={closeSelector}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                testID="group-selector-close">
                <Feather color="#1E2A1E" name="x" size={17} />
              </Pressable>
            </View>

            {isLoading ? (
              <View style={styles.statusWrap} testID="group-selector-loading">
                <ActivityIndicator color="#2E6B4B" size="small" />
                <Text style={styles.statusText}>Freunde werden geladen …</Text>
              </View>
            ) : members.length === 0 ? (
              <Text style={styles.emptyText}>
                Du hast noch keine bestätigten Freunde für deine Wandergruppe.
              </Text>
            ) : (
              <ScrollView
                contentContainerStyle={styles.membersList}
                showsVerticalScrollIndicator={false}
                style={styles.membersScroll}>
                {members.map((member, index) => {
                  const isSelected = selectedFriendIds.includes(member.id);
                  return (
                    <Pressable
                      accessibilityLabel={`${member.name} ${
                        isSelected ? 'aus der Wandergruppe entfernen' : 'zur Wandergruppe hinzufügen'
                      }`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      key={member.id}
                      onPress={() => toggleFriend(member.id)}
                      style={({ pressed }) => [
                        styles.memberRow,
                        isSelected && styles.memberRowSelected,
                        pressed && styles.pressed,
                      ]}
                      testID={`group-selector-friend-${member.id}`}>
                      <FriendAvatar
                        image={member.picture}
                        index={index}
                        radius={18}
                        size={42}
                      />
                      <View style={styles.memberCopy}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberMeta}>
                          {member.visitedCount} Stempel · {member.completionPercent} %
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}>
                        {isSelected ? (
                          <Feather color="#FFFFFF" name="check" size={15} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Wandergruppe leeren"
                accessibilityRole="button"
                disabled={selectionCount === 0}
                onPress={clearGroup}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  selectionCount === 0 && styles.buttonDisabled,
                  pressed && selectionCount > 0 && styles.pressed,
                ]}
                testID="group-selector-clear">
                <Text
                  style={[
                    styles.secondaryButtonLabel,
                    selectionCount === 0 && styles.buttonLabelDisabled,
                  ]}>
                  Auswahl leeren
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Gruppenauswahl übernehmen"
                accessibilityRole="button"
                onPress={closeSelector}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                testID="group-selector-done">
                <Text style={styles.primaryButtonLabel}>Fertig</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF4EE',
    borderColor: '#D3E1D4',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  triggerLabel: {
    color: '#2E3A2E',
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: '#2E6B4B',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 5,
  },
  countBadgeLabel: {
    color: '#FFFFFF',
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 42, 30, 0.42)',
  },
  modalCard: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    maxHeight: '82%',
    maxWidth: 520,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    width: '100%',
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeading: {
    flex: 1,
    gap: 5,
  },
  modalTitle: {
    color: '#1E2A1E',
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 26,
  },
  modalDescription: {
    color: '#667466',
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#F0E9DD',
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  statusWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  statusText: {
    color: '#667466',
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: '#667466',
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 8,
    paddingVertical: 24,
    textAlign: 'center',
  },
  membersList: {
    gap: 9,
    paddingBottom: 4,
  },
  membersScroll: {
    flexShrink: 1,
  },
  memberRow: {
    alignItems: 'center',
    backgroundColor: '#F7F4ED',
    borderColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 62,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  memberRowSelected: {
    backgroundColor: '#EEF7F0',
    borderColor: '#9FC2A8',
  },
  memberCopy: {
    flex: 1,
  },
  memberName: {
    color: '#1E2A1E',
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  memberMeta: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#96A296',
    borderRadius: 7,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxSelected: {
    backgroundColor: '#2E6B4B',
    borderColor: '#2E6B4B',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#CAD5CA',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: '#2E6B4B',
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2E6B4B',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  primaryButtonLabel: {
    color: '#F5F3EE',
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabelDisabled: {
    color: '#879287',
  },
  pressed: {
    opacity: 0.86,
  },
});
