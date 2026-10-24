import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FOLDER_NAME_MAX_LENGTH } from '@/constants/config';
import {
  radii,
  spacing,
  typography,
  type Palette,
} from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { isUnfiled, isInFolder } from '@/lib/sorting';
import type { Document, Folder } from '@/types/document';

type CreateStatus = 'ok' | 'duplicate' | 'invalid' | 'error';

export const FOLDER_RESULT_ERRORS: Record<'duplicate' | 'invalid' | 'error', string> = {
  duplicate: 'A folder with that name already exists.',
  invalid: 'Please give the folder a name.',
  error: 'Something went wrong. Please try again.',
};

interface MoveFolderSheetProps {
  visible: boolean;
  doc: Document | null;
  folders: Folder[];
  /** Moves into an existing folder, or Unfiled with null. */
  onMove: (folderId: string | null) => void;
  /** Creates and moves in one step ("New folder" row). */
  onCreateFolder: (name: string) => Promise<CreateStatus>;
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
    cancelButton: {
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    cancelLabel: {
      ...typography.cardTitle,
      color: colors.textSecondary,
      fontSize: 15,
    },
    list: {
      maxHeight: 320,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
    },
    rowPressed: {
      backgroundColor: colors.surface,
    },
    rowLabel: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 15,
      flex: 1,
    },
    rowLabelFaint: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 12,
      textAlign: 'center',
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.xs,
    },
    check: {
      width: 22,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginVertical: spacing.xs,
    },
    newRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
    },
    newLabel: {
      ...typography.cardTitle,
      color: colors.primary,
      fontSize: 15,
    },
    createForm: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    createHint: {
      ...typography.badge,
      color: colors.textSecondary,
      marginBottom: spacing.md,
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
    createActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    btn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: radii.sm,
    },
    btnSecondary: {
      color: colors.textSecondary,
      fontSize: 15,
    },
    btnPrimary: {
      backgroundColor: colors.primary,
    },
    btnPrimaryText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
  });

/**
 * "Move to folder" sheet: every folder plus Unfiled (with a check on the
 * document's current location), and a "New folder" row that switches to a
 * name-input stage — creating the folder and moving the scan in one step.
 */
export default function MoveFolderSheet({
  visible,
  doc,
  folders,
  onMove,
  onCreateFolder,
  onClose,
}: MoveFolderSheetProps) {
  const { colors, resolved } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors, resolved]);
  const [stage, setStage] = useState<'list' | 'create'>('list');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setStage('list');
      setName('');
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  if (!doc) {
    return null;
  }

  const submitCreate = async () => {
    const trimmed = name.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      setError(FOLDER_RESULT_ERRORS.invalid);
      return;
    }
    setBusy(true);
    try {
      const result = await onCreateFolder(trimmed);
      if (result === 'ok') {
        onClose();
        return;
      }
      setError(FOLDER_RESULT_ERRORS[result]);
    } catch {
      setError(FOLDER_RESULT_ERRORS.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            {stage === 'list' ? (
              <>
                <Text style={styles.title}>Move to folder</Text>
                <ScrollView style={styles.list} nestedScrollEnabled>
                  <Pressable
                    onPress={() => {
                      onClose();
                      onMove(null);
                    }}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <Ionicons name="albums-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.rowLabel}>Unfiled</Text>
                    {isUnfiled(doc) ? (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                  {folders.map((folder) => (
                    <Pressable
                      key={folder.id}
                      onPress={() => {
                        onClose();
                        onMove(folder.id);
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <Ionicons name="folder" size={20} color={colors.primary} />
                      <Text style={styles.rowLabel} numberOfLines={1}>
                        {folder.name}
                      </Text>
                      {isInFolder(doc, folder.id) ? (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.divider} />
                <Pressable
                  onPress={() => {
                    setName('');
                    setError(null);
                    setStage('create');
                  }}
                  style={({ pressed }) => [styles.newRow, pressed && styles.rowPressed]}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.newLabel}>New folder</Text>
                </Pressable>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.createForm}>
                <Text style={styles.createHint}>
                  Create a folder and move “{doc.title}” into it in one step.
                </Text>
                <TextInput
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setError(null);
                  }}
                  autoFocus
                  selectTextOnFocus
                  maxLength={FOLDER_NAME_MAX_LENGTH}
                  style={styles.input}
                  placeholder="Folder name"
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={() => void submitCreate()}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.createActions}>
                  <Pressable
                    onPress={() => setStage('list')}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.btn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.btnSecondary}>Back</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void submitCreate()}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnPrimary,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Text style={styles.btnPrimaryText}>Create</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
