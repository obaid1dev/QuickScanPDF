import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/constants/theme';

export interface ActionMenuOption {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  danger?: boolean;
  onPress: () => void;
}

interface ActionMenuProps {
  visible: boolean;
  title?: string;
  options: ActionMenuOption[];
  onClose: () => void;
}

export default function ActionMenu({
  visible,
  title,
  options,
  onClose,
}: ActionMenuProps) {
  const close = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={close} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {options.map((option) => (
              <Pressable
                key={option.label}
                onPress={() => {
                  close();
                  option.onPress();
                }}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={option.danger ? colors.danger : colors.textPrimary}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    option.danger && styles.optionLabelDanger,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={close}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.optionPressed]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheet: {
    backgroundColor: colors.surfaceLighter,
    borderRadius: radii.lg,
    overflow: 'hidden',
    paddingVertical: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.secondary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 15,
  },
  optionPressed: {
    backgroundColor: colors.surface,
  },
  optionLabel: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    fontSize: 15,
  },
  optionLabelDanger: {
    color: colors.danger,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.secondary,
  },
  cancelLabel: {
    ...typography.cardTitle,
    color: colors.textSecondary,
    fontSize: 15,
  },
});