import { Feather } from '@expo/vector-icons';
import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

type ClearableSearchInputProps = TextInputProps & {
  /** Inputs outside an existing horizontal search shell keep their natural width. */
  standalone?: boolean;
};

export const ClearableSearchInput = forwardRef<TextInput, ClearableSearchInputProps>(
  function ClearableSearchInput({ standalone = false, style, value, onChangeText, editable, ...props }, ref) {
    const canClear = Boolean(value?.length) && editable !== false && Boolean(onChangeText);

    return (
      <View style={standalone ? styles.standalone : styles.container}>
        <TextInput
          {...props}
          ref={ref}
          clearButtonMode="never"
          editable={editable}
          onChangeText={onChangeText}
          style={[style, styles.input, canClear && styles.inputWithClearButton]}
          value={value}
        />
        {canClear ? (
          <Pressable
            accessibilityLabel="Suche leeren"
            accessibilityRole="button"
            onPress={() => onChangeText?.('')}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Feather color="#6b7a6b" name="x" size={18} />
          </Pressable>
        ) : null}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
  },
  standalone: {
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    minWidth: 0,
  },
  inputWithClearButton: {
    paddingRight: 44,
  },
  clearButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});
