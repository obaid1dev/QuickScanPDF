import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { PrimaryButton } from '@/components/Buttons';
import type { Folder } from '@/types/document';

interface FolderTileGridProps {
  folders: Folder[];
  /** Document count per folder id (computed by the parent screen). */
  counts: Record<string, number>;
  onOpenFolder: (folder: Folder) => void;
  onNewFolder: () => void;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 12,
      rowGap: 12,
      alignItems: 'flex-start',
    },
    tile: {
      width: '48.6%',
      aspectRatio: 1.15,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      paddingTop: spacing.lg,
    },
    tilePressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.94,
    },
    // Soft icon badge at the tile's top-left: accent tint, accent folder icon.
    tileIconBadge: {
      width: 34,
      height: 34,
      borderRadius: radii.round,
      backgroundColor: colors.accentPill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    tileName: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    tileCount: {
      ...typography.badge,
      color: colors.textSecondary,
      marginTop: 2,
    },
    newTile: {
      width: '48.6%',
      aspectRatio: 1.15,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newTileLabel: {
      ...typography.badge,
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: spacing.xs,
    },
    emptyPlusWidth: {
      alignSelf: 'center',
      minWidth: 180,
    },
    // Empty state: one large centered dashed block inviting the first folder.
    emptyWrap: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    emptyBlock: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: colors.surface,
      alignItems: 'center',
      padding: spacing.xxl,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: radii.round,
      backgroundColor: colors.accentPill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 18,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    emptyBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
  });

/**
 * The Folders view: a 2-column grid of folder tiles (icon, bold name, muted
 * scan count), ending with a dashed "New folder" tile. When no folders exist
 * it renders one large dashed "Create your first folder" block instead.
 */
export default function FolderTileGrid({
  folders,
  counts,
  onOpenFolder,
  onNewFolder,
}: FolderTileGridProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (folders.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Pressable
          onPress={onNewFolder}
          style={({ pressed }) => [styles.emptyBlock, pressed && styles.tilePressed]}
        >
          <View style={styles.emptyIconWrap}>
            <Ionicons name="folder-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Create your first folder</Text>
          <Text style={styles.emptyBody}>
            Group your scans by subject, like Work, School, or Receipts
          </Text>
          <PrimaryButton
            label="New folder"
            icon="add"
            onPress={onNewFolder}
            style={styles.emptyPlusWidth}
          />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {folders.map((folder) => {
        const count = counts[folder.id] ?? 0;
        return (
          <Pressable
            key={folder.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onOpenFolder(folder);
            }}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open folder ${folder.name}, ${count} documents`}
          >
            <View style={styles.tileIconBadge}>
              <Ionicons name="folder" size={20} color={colors.primary} />
            </View>
            <Text style={styles.tileName} numberOfLines={1}>
              {folder.name}
            </Text>
            <Text style={styles.tileCount}>
              {count} scan{count === 1 ? '' : 's'}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onNewFolder();
        }}
        style={({ pressed }) => [styles.newTile, pressed && styles.tilePressed]}
        accessibilityRole="button"
        accessibilityLabel="Create new folder"
      >
        <Ionicons name="add" size={24} color={colors.textSecondary} />
        <Text style={styles.newTileLabel}>New folder</Text>
      </Pressable>
    </View>
  );
}
