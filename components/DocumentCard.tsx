import React, { memo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActionMenu, { type ActionMenuOption } from '@/components/ActionMenu';
import ConfirmDialog from '@/components/ConfirmDialog';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { formatBytes } from '@/lib/fileManager';
import { formatRelativeTime } from '@/lib/format';
import type { Document } from '@/types/document';

interface DocumentCardProps {
  document: Document;
  onRename: (id: string, title: string) => Promise<void> | void;
  onDownload: (doc: Document) => Promise<void> | void;
  onShare: (doc: Document) => void;
  onDelete: (id: string) => void;
  onPress?: (doc: Document) => void;
}

function DocumentCard({
  document,
  onRename,
  onDownload,
  onShare,
  onDelete,
  onPress,
}: DocumentCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState(document.title);

  const menuOptions: ActionMenuOption[] = [
    {
      icon: 'create-outline',
      label: 'Rename',
      onPress: () => {
        setRenameText(document.title);
        setRenameVisible(true);
      },
    },
    {
      icon: 'download-outline',
      label: 'Download',
      onPress: () => void onDownload(document),
    },
    {
      icon: 'share-outline',
      label: 'Share',
      onPress: () => onShare(document),
    },
    {
      icon: 'trash-outline',
      label: 'Delete',
      danger: true,
      onPress: () => setConfirmVisible(true),
    },
  ];

  const submitRename = () => {
    const title = renameText.trim();
    setRenameVisible(false);
    if (title && title !== document.title) {
      void onRename(document.id, title);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => onPress?.(document)}
        onLongPress={() => setMenuVisible(true)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.thumbWrap}>
          {imageFailed || !document.thumbnailUri ? (
            <View style={styles.thumbFallback}>
              <Ionicons name="document-text" size={22} color={colors.textSecondary} />
            </View>
          ) : (
            <Image
              source={{ uri: document.thumbnailUri }}
              style={styles.thumb}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {document.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {document.pageCount} page{document.pageCount === 1 ? '' : 's'} •{' '}
            {formatBytes(document.fileSizeBytes)} •{' '}
            {formatRelativeTime(document.createdAt)}
          </Text>
        </View>

        <Pressable
          hitSlop={10}
          onPress={() => setMenuVisible(true)}
          style={styles.menuButton}
          accessibilityLabel="Document options"
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        </Pressable>
      </Pressable>

      <ActionMenu
        visible={menuVisible}
        title={document.title}
        options={menuOptions}
        onClose={() => setMenuVisible(false)}
      />

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete scan?"
        message="This will permanently delete the PDF from your device."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          setConfirmVisible(false);
          onDelete(document.id);
        }}
        onCancel={() => setConfirmVisible(false)}
      />

      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename scan</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              maxLength={60}
              style={styles.input}
              placeholder="Scan title"
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={submitRename}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setRenameVisible(false)}
                style={styles.modalBtn}
              >
                <Text style={styles.modalBtnSecondary}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitRename}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={styles.modalBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  thumbWrap: {
    width: 52,
    height: 64,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLighter,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLighter,
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    fontSize: 15,
  },
  meta: {
    ...typography.badge,
    color: colors.textSecondary,
    marginTop: 3,
  },
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surfaceLighter,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  modalTitle: {
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
    borderColor: colors.secondary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.sm,
  },
  modalBtnSecondary: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  modalBtnPrimary: {
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default memo(DocumentCard);