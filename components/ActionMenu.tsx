import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

export interface ActionMenuOption {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  danger?: boolean;
  /** Shows an accent check at the row's end (the active sort option). */
  selected?: boolean;
  onPress: () => void;
}

interface ActionMenuProps {
  visible: boolean;
  title?: string;
  options: ActionMenuOption[];
  onClose: () => void;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
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
      borderBottomColor: colors.border,
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
      color: colors.dangerText,
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 15,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    cancelLabel: {
      ...typography.cardTitle,
      color: colors.textSecondary,
      fontSize: 15,
    },
  });

export default function ActionMenu({
  visible,
  title,
  options,
  onClose,
}: ActionMenuProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
                {option.selected ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
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
