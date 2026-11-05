import { AppColors, Layout } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

type ClearableSearchInputProps = TextInputProps & {
  /** Inputs outside an existing horizontal search shell keep their natural width. */
  standalone?: boolean;
};

export const ClearableSearchInput = forwardRef<TextInput, ClearableSearchInputProps>(
  function ClearableSearchInput({ standalone = false, style, value, onChangeText, editable, onFocus, onBlur, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    const canClear = Boolean(value?.length) && editable !== false && Boolean(onChangeText);

    return (
      <View style={[standalone ? styles.standalone : styles.container, Platform.OS === 'web' && focused && !onFocus && styles.focused]}>
        <TextInput
          {...props}
          ref={ref}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          clearButtonMode="never"
          editable={editable}
          onChangeText={onChangeText}
          style={[style, styles.input, Platform.OS === 'web' && { outlineStyle: 'solid', outlineWidth: 0, outlineColor: 'transparent' }, canClear && styles.inputWithClearButton]}
          value={value}
        />
        {canClear ? (
          <Pressable
            accessibilityLabel="Suche leeren"
            accessibilityRole="button"
            onPress={() => onChangeText?.('')}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Feather color={AppColors.textMuted} name="x" size={18} />
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
  focused: {
    outlineColor: AppColors.primary,
    outlineWidth: 2,
    outlineStyle: 'solid',
    borderRadius: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
  },
  inputWithClearButton: {
    paddingRight: Layout.touchTarget,
  },
  clearButton: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -Layout.touchTarget / 2,
    height: Layout.touchTarget,
    width: Layout.touchTarget,
    minHeight: Layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});
