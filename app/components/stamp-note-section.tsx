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
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meine Notiz</Text>
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
        </View>

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  sectionAction: {
    borderRadius: 999,
    backgroundColor: '#eef4ef',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionActionPressed: {
    opacity: 0.82,
  },
  sectionActionLabel: {
    color: '#2e6b4b',
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
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  noteCountTextError: {
    color: '#8a3d2f',
  },
});
