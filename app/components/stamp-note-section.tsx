import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionCard } from '@/components/section-card';
import { AppColors } from '@/constants/theme';

type StampNoteSectionProps = {
  noteDraft: string;
  noteLength: number;
  maxLength: number;
  isSaving: boolean;
  isDirty: boolean;
  isTooLong: boolean;
  onChangeNote: (value: string) => void;
  onSave: () => void;
};

export function StampNoteSection({
  noteDraft,
  noteLength,
  maxLength,
  isSaving,
  isDirty,
  isTooLong,
  onChangeNote,
  onSave,
}: StampNoteSectionProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 0}>
      <SectionCard
        title="Meine Notiz"
        action={
          <View style={styles.noteActionSlot}>
            {isDirty || isSaving ? (
              <Pressable
                disabled={isSaving || isTooLong}
                onPress={onSave}
                style={({ pressed }) => [
                  styles.sectionAction,
                  (isSaving || isTooLong) && styles.actionDisabled,
                  pressed && !isSaving && !isTooLong && styles.sectionActionPressed,
                ]}>
                <Text style={styles.sectionActionLabel}>{isSaving ? 'Speichert...' : 'Speichern'}</Text>
              </Pressable>
            ) : null}
          </View>
        }>
        <View style={styles.noteInputContainer}>
          <TextInput
            editable={!isSaving}
            multiline
            onChangeText={onChangeNote}
            placeholder={'Deine persönliche Notiz zu diesem Stempel\n(z. B. Erinnerung, Tipp oder 3-stelliger Defektcode)'}
            placeholderTextColor="#8b957f"
            style={styles.noteInput}
            textAlignVertical="top"
            value={noteDraft}
          />
        </View>

        <View style={styles.noteMetaRow}>
          {isTooLong ? (
            <Text style={styles.noteErrorText}>Maximal {maxLength} Zeichen (nach trim()).</Text>
          ) : (
            <View />
          )}
          <Text style={[styles.noteCountText, isTooLong && styles.noteCountTextError]}>
            {noteLength}/{maxLength}
          </Text>
        </View>
      </SectionCard>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sectionAction: {
    borderRadius: 999,
    backgroundColor: AppColors.actionSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionActionPressed: {
    opacity: 0.82,
  },
  sectionActionLabel: {
    color: AppColors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  noteActionSlot: {
    minHeight: 28,
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  noteInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3e9df',
    backgroundColor: '#f9faf7',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteInput: {
    minHeight: 92,
    color: '#233023',
    fontSize: 14,
    lineHeight: 20,
    padding: 0,
  },
  noteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  noteErrorText: {
    color: '#8a3d2f',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  noteCountText: {
    color: AppColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  noteCountTextError: {
    color: '#8a3d2f',
  },
});
