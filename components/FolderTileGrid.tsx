import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
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
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    tilePressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.92,
    },
    tileIcon: {
      marginBottom: spacing.sm,
    },
    tileName: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 15,
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
    emptyPlus: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radii.round,
      paddingHorizontal: spacing.xl,
      paddingVertical: 12,
    },
    emptyPlusPressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.9,
    },
    emptyPlusLabel: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '700',
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
          <Pressable
            onPress={onNewFolder}
            hitSlop={8}
            style={({ pressed }) => [
              styles.emptyPlus,
              pressed && styles.emptyPlusPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create new folder"
          >
            <Ionicons name="add" size={20} color={colors.onPrimary} />
            <Text style={styles.emptyPlusLabel}>New folder</Text>
          </Pressable>
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
            <Ionicons
              name="folder"
              size={26}
              color={colors.primary}
              style={styles.tileIcon}
            />
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
