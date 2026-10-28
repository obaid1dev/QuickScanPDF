import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FOLDER_NAME_MAX_LENGTH } from '@/constants/config';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import {
  radii,
  spacing,
  typography,
  type Palette,
} from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface FolderNameDialogProps {
  visible: boolean;
  /** "New folder" for creation, "Rename folder" for edits. */
  title: string;
  confirmLabel?: string;
  initialName?: string;
  /** Set by the parent after validating the submitted name. */
  error?: string | null;
  onSubmit: (name: string) => void;
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
      backgroundColor: colors.surfaceLighter,
      borderRadius: radii.lg,
      padding: spacing.xl,
    },
    title: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    error: {
      ...typography.badge,
      color: colors.dangerText,
      marginTop: spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    dialogButton: {
      flex: 1,
    },
  });

/**
 * Centered text-input dialog shared by "New folder" and "Rename folder".
 * The parent owns validation so both screens show identical error strings.
 */
export default function FolderNameDialog({
  visible,
  title,
  confirmLabel = 'Save',
  initialName = '',
  error = null,
  onSubmit,
  onCancel,
}: FolderNameDialogProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (visible) {
      setName(initialName);
    }
  }, [visible, initialName]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            selectTextOnFocus
            maxLength={FOLDER_NAME_MAX_LENGTH}
            style={styles.input}
            placeholder="Folder name"
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={() => onSubmit(name)}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <SecondaryButton
              label="Cancel"
              onPress={onCancel}
              style={styles.dialogButton}
            />
            <PrimaryButton
              label={confirmLabel}
              onPress={() => onSubmit(name)}
              style={styles.dialogButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
