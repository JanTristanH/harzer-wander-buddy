import { Design } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

type OverflowAction = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  disabled?: boolean;
};

type DetailOverflowMenuProps = {
  actions: OverflowAction[];
  topOffset: number;
};

export function DetailOverflowMenu({ actions, topOffset }: DetailOverflowMenuProps) {
  const [isVisible, setIsVisible] = useState(false);

  const enabledActions = useMemo(() => actions.filter((action) => Boolean(action)), [actions]);

  const closeMenu = useCallback(() => {
    setIsVisible(false);
  }, []);

  const openMenu = useCallback(() => {
    setIsVisible(true);
  }, []);

  const handleActionPress = useCallback(
    (action: OverflowAction) => {
      closeMenu();
      action.onPress();
    },
    [closeMenu]
  );

  if (enabledActions.length === 0) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aktionen"
        accessibilityState={{ expanded: isVisible }}
        hitSlop={10}
        onPress={openMenu}
        style={({ pressed }) => [styles.overflowHeaderButton, pressed && styles.headerButtonPressed]}>
        <Feather color="#2e3a2e" name="more-vertical" size={16} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={closeMenu} transparent visible={isVisible}>
        <Pressable onPress={closeMenu} style={styles.overflowModalBackdrop}>
          <Pressable onPress={() => undefined} style={[styles.overflowPopover, { top: topOffset }]}>
            <Text style={styles.overflowTitle}>Aktionen</Text>
            {enabledActions.map((action) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !!action.disabled }}
                key={action.key}
                disabled={action.disabled}
                onPress={() => handleActionPress(action)}
                style={({ pressed }) => [
                  styles.overflowActionButton,
                  action.disabled && styles.overflowActionButtonDisabled,
                  pressed && !action.disabled && styles.headerButtonPressed,
                ]}>
                <Feather color={action.disabled ? '#98a398' : Design.color.brand} name={action.icon} size={15} />
                <Text
                  style={[
                    styles.overflowActionLabel,
                    action.disabled && styles.overflowActionLabelDisabled,
                  ]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overflowHeaderButton: {
    width: Design.touch,
    height: Design.touch,
    borderRadius: 10,
    backgroundColor: '#eef4ee',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  headerButtonPressed: {
    opacity: 0.88,
  },
  overflowModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,30,20,0.16)',
  },
  overflowPopover: {
    position: 'absolute',
    right: 16,
    width: 240,
    backgroundColor: Design.color.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  overflowTitle: {
    color: Design.color.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  overflowActionButton: {
    minHeight: Design.touch,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef7f0',
  },
  overflowActionButtonDisabled: {
    backgroundColor: '#f1f4f1',
  },
  overflowActionLabel: {
    color: Design.color.ink,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  overflowActionLabelDisabled: {
    color: '#98a398',
  },
});
