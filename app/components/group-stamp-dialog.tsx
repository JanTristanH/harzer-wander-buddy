import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useHikingGroup } from '@/lib/hiking-group';
import { isNetworkUnavailableError } from '@/lib/offline-write';

export type GroupStampDialogProps = {
  visible: boolean;
  stampId: string;
  stampName: string;
  includeCurrentUser: boolean;
  currentUserAlreadyStamped: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

type StampForGroupPayload = {
  stampId: string;
  friendIds: string[];
  includeCurrentUser: boolean;
};

type GroupStampApi = typeof api & {
  stampForGroup: (
    accessToken: string,
    payload: StampForGroupPayload
  ) => Promise<unknown>;
};

const groupStampApi = api as GroupStampApi;

const AUTH_ERROR_MESSAGE =
  'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.';
const OFFLINE_ERROR_MESSAGE =
  'Du bist offline. Gruppenstempeln ist nur mit Internetverbindung möglich.';
const GENERIC_ERROR_MESSAGE =
  'Der Gruppenstempel konnte nicht gespeichert werden. Bitte versuche es erneut.';

export function GroupStampDialog({
  visible,
  stampId,
  stampName,
  includeCurrentUser,
  currentUserAlreadyStamped,
  onClose,
  onSuccess,
}: GroupStampDialogProps) {
  const queryClient = useQueryClient();
  const {
    accessToken,
    canPerformWrites,
    isAuthenticated,
    isOffline,
    logout,
  } = useAuth();
  const { isLoading, members, selectedFriendIds } = useHikingGroup();
  const [selectedStampFriendIds, setSelectedStampFriendIds] = useState<string[]>([]);
  const [shouldIncludeCurrentUser, setShouldIncludeCurrentUser] = useState(false);
  const [isInitializedForOpen, setIsInitializedForOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allowedFriendIds = useMemo(
    () =>
      new Set(
        members
          .filter((member) => member.isAllowedToStampForFriend)
          .map((member) => member.id)
      ),
    [members]
  );

  useEffect(() => {
    if (!visible) {
      setIsInitializedForOpen(false);
      setErrorMessage(null);
      return;
    }

    if (isLoading || isInitializedForOpen) {
      return;
    }

    setSelectedStampFriendIds(
      selectedFriendIds.filter((friendId) => allowedFriendIds.has(friendId))
    );
    setShouldIncludeCurrentUser(
      includeCurrentUser && !currentUserAlreadyStamped
    );
    setErrorMessage(null);
    setIsInitializedForOpen(true);
  }, [
    allowedFriendIds,
    currentUserAlreadyStamped,
    includeCurrentUser,
    isInitializedForOpen,
    isLoading,
    selectedFriendIds,
    visible,
  ]);

  useEffect(() => {
    if (!visible || !isInitializedForOpen) {
      return;
    }

    setSelectedStampFriendIds((currentIds) =>
      currentIds.filter((friendId) => allowedFriendIds.has(friendId))
    );
  }, [allowedFriendIds, isInitializedForOpen, visible]);

  const toggleStampFriend = useCallback(
    (friendId: string) => {
      if (!allowedFriendIds.has(friendId)) {
        return;
      }

      setSelectedStampFriendIds((currentIds) =>
        currentIds.includes(friendId)
          ? currentIds.filter((currentId) => currentId !== friendId)
          : [...currentIds, friendId]
      );
      setErrorMessage(null);
    },
    [allowedFriendIds]
  );

  const closeDialog = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const canSubmit =
    isInitializedForOpen &&
    !isLoading &&
    !isSubmitting &&
    stampId.trim().length > 0 &&
    (selectedStampFriendIds.length > 0 || shouldIncludeCurrentUser);

  const confirmGroupStamp = useCallback(async () => {
    if (
      (selectedStampFriendIds.length === 0 && !shouldIncludeCurrentUser) ||
      isSubmitting
    ) {
      return;
    }

    setErrorMessage(null);

    if (!isAuthenticated || !accessToken) {
      setErrorMessage(AUTH_ERROR_MESSAGE);
      return;
    }

    if (isOffline || !canPerformWrites) {
      setErrorMessage(OFFLINE_ERROR_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    try {
      await groupStampApi.stampForGroup(accessToken, {
        stampId,
        friendIds: selectedStampFriendIds,
        includeCurrentUser: shouldIncludeCurrentUser,
      });
      await queryClient.invalidateQueries();
      await onSuccess();
      onClose();
    } catch (nextError) {
      if (
        isOffline ||
        isNetworkUnavailableError(nextError) ||
        nextError instanceof TypeError
      ) {
        setErrorMessage(OFFLINE_ERROR_MESSAGE);
        return;
      }

      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        setErrorMessage(AUTH_ERROR_MESSAGE);
        await logout();
        onClose();
        return;
      }

      setErrorMessage(GENERIC_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    accessToken,
    canPerformWrites,
    isAuthenticated,
    isOffline,
    isSubmitting,
    logout,
    onClose,
    onSuccess,
    queryClient,
    selectedStampFriendIds,
    shouldIncludeCurrentUser,
    stampId,
  ]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeDialog}
      transparent
      visible={visible}>
      <View style={styles.modalOverlay} testID="group-stamp-dialog">
        <Pressable
          accessibilityLabel="Gruppenstempel schließen"
          disabled={isSubmitting}
          onPress={closeDialog}
          style={styles.modalBackdrop}
          testID="group-stamp-backdrop"
        />
        <View accessibilityViewIsModal style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Für Gruppe stempeln</Text>
              <Text style={styles.stampName}>{stampName || 'Stempelstelle'}</Text>
            </View>
            <Pressable
              accessibilityLabel="Gruppenstempel schließen"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={closeDialog}
              style={({ pressed }) => [
                styles.closeButton,
                isSubmitting && styles.buttonDisabled,
                pressed && !isSubmitting && styles.pressed,
              ]}
              testID="group-stamp-close">
              <Feather color="#1E2A1E" name="x" size={17} />
            </Pressable>
          </View>

          <Text style={styles.description}>
            Wähle Freunde aus, die dir erlaubt haben, für sie zu stempeln.
          </Text>

          {isLoading ? (
            <View style={styles.statusWrap} testID="group-stamp-loading">
              <ActivityIndicator color="#2E6B4B" size="small" />
              <Text style={styles.statusText}>Berechtigungen werden geladen …</Text>
            </View>
          ) : members.length === 0 ? (
            <Text style={styles.emptyText}>
              Du hast noch keine bestätigten Freunde.
            </Text>
          ) : (
            <ScrollView
              contentContainerStyle={styles.membersList}
              showsVerticalScrollIndicator={false}
              style={styles.membersScroll}>
              {members.map((member, index) => {
                const isAllowed = allowedFriendIds.has(member.id);
                const isSelected = selectedStampFriendIds.includes(member.id);
                return (
                  <Pressable
                    accessibilityLabel={
                      isAllowed
                        ? `${member.name} ${
                            isSelected ? 'nicht mitstempeln' : 'mitstempeln'
                          }`
                        : `${member.name}, keine Stempelberechtigung`
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: isSelected,
                      disabled: !isAllowed,
                    }}
                    disabled={!isAllowed || isSubmitting}
                    key={member.id}
                    onPress={() => toggleStampFriend(member.id)}
                    style={({ pressed }) => [
                      styles.memberRow,
                      isSelected && styles.memberRowSelected,
                      !isAllowed && styles.memberRowDisabled,
                      pressed && isAllowed && styles.pressed,
                    ]}
                    testID={`group-stamp-friend-${member.id}`}>
                    <FriendAvatar
                      image={member.picture}
                      index={index}
                      radius={18}
                      size={42}
                    />
                    <View style={styles.memberCopy}>
                      <Text
                        style={[
                          styles.memberName,
                          !isAllowed && styles.textDisabled,
                        ]}>
                        {member.name}
                      </Text>
                      <Text
                        style={[
                          styles.memberMeta,
                          !isAllowed && styles.textDisabled,
                        ]}>
                        {isAllowed
                          ? 'Darf von dir gestempelt werden'
                          : 'Keine Stempelberechtigung'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                        !isAllowed && styles.checkboxDisabled,
                      ]}>
                      {isSelected ? (
                        <Feather color="#FFFFFF" name="check" size={15} />
                      ) : !isAllowed ? (
                        <Feather color="#98A398" name="lock" size={13} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            accessibilityLabel={
              currentUserAlreadyStamped
                ? 'Für mich erneut stempeln'
                : 'Für mich stempeln'
            }
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: shouldIncludeCurrentUser,
              disabled: isSubmitting,
            }}
            disabled={isSubmitting}
            onPress={() => {
              setShouldIncludeCurrentUser((currentValue) => !currentValue);
              setErrorMessage(null);
            }}
            style={({ pressed }) => [
              styles.selfRow,
              pressed && !isSubmitting && styles.pressed,
            ]}
            testID="group-stamp-include-current-user">
            <View
              style={[
                styles.checkbox,
                shouldIncludeCurrentUser && styles.checkboxSelected,
              ]}>
              {shouldIncludeCurrentUser ? (
                <Feather color="#FFFFFF" name="check" size={15} />
              ) : null}
            </View>
            <View style={styles.memberCopy}>
              <Text
                style={styles.selfLabel}>
                {currentUserAlreadyStamped ? 'Für mich erneut stempeln' : 'Für mich stempeln'}
              </Text>
              {currentUserAlreadyStamped ? (
                <Text style={styles.memberMeta}>
                  Du hast hier bereits gestempelt. Die Auswahl erzeugt einen weiteren Besuch.
                </Text>
              ) : null}
            </View>
          </Pressable>

          {errorMessage ? (
            <Text
              accessibilityRole="alert"
              style={styles.errorText}
              testID="group-stamp-error">
              {errorMessage}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Gruppenstempel abbrechen"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={closeDialog}
              style={({ pressed }) => [
                styles.secondaryButton,
                isSubmitting && styles.buttonDisabled,
                pressed && !isSubmitting && styles.pressed,
              ]}
              testID="group-stamp-cancel">
              <Text style={styles.secondaryButtonLabel}>Abbrechen</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Ausgewählte Gruppe stempeln"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={() => void confirmGroupStamp()}
              style={({ pressed }) => [
                styles.primaryButton,
                !canSubmit && styles.primaryButtonDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
              testID="group-stamp-confirm">
              {isSubmitting ? (
                <ActivityIndicator color="#F5F3EE" size="small" />
              ) : (
                <Text
                  style={[
                    styles.primaryButtonLabel,
                    !canSubmit && styles.primaryButtonLabelDisabled,
                  ]}>
                  Gruppe stempeln
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '86%',
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
  },
  modalHeading: {
    flex: 1,
    gap: 3,
  },
  modalTitle: {
    color: '#1E2A1E',
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 26,
  },
  stampName: {
    color: '#2E6B4B',
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#F0E9DD',
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  description: {
    color: '#667466',
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: 10,
  },
  statusWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
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
    paddingVertical: 20,
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
  memberRowDisabled: {
    backgroundColor: '#F3F4F1',
    opacity: 0.72,
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
  checkboxDisabled: {
    backgroundColor: '#EAEEEA',
    borderColor: '#C8D0C8',
  },
  selfRow: {
    alignItems: 'center',
    backgroundColor: '#EEF4EE',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 11,
    marginTop: 13,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selfLabel: {
    color: '#1E2A1E',
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  textDisabled: {
    color: '#879287',
  },
  errorText: {
    backgroundColor: '#FFF1EE',
    borderRadius: 12,
    color: '#A33D2F',
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    minWidth: 134,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: '#CFD8CF',
  },
  primaryButtonLabel: {
    color: '#F5F3EE',
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  primaryButtonLabelDisabled: {
    color: '#778277',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.86,
  },
});
