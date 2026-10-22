import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface ConfirmDialogProps {
  visible: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surfaceLighter,
      borderRadius: radii.lg,
      padding: spacing.xl,
      alignItems: 'center',
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    iconWrapDanger: {
      backgroundColor: colors.dangerSoft,
    },
    iconWrapNeutral: {
      backgroundColor: colors.primarySoft,
    },
    title: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 17,
      textAlign: 'center',
    },
    message: {
      ...typography.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      columnGap: spacing.sm,
      marginTop: spacing.xl,
      width: '100%',
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      paddingVertical: 12,
    },
    cancelLabel: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 15,
    },
    confirmBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 12,
    },
    confirmBtnDanger: {
      backgroundColor: colors.danger,
    },
    confirmLabel: {
      ...typography.cardTitle,
      color: colors.onPrimary,
      fontSize: 15,
    },
    pressed: {
      opacity: 0.85,
    },
  });

export default function ConfirmDialog({
  visible,
  icon = 'trash-outline',
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View
            style={[
              styles.iconWrap,
              danger ? styles.iconWrapDanger : styles.iconWrapNeutral,
            ]}
          >
            <Ionicons
              name={icon}
              size={26}
              color={danger ? colors.danger : colors.textPrimary}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                danger && styles.confirmBtnDanger,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
