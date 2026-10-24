import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  cardShadow,
  radii,
  spacing,
  typography,
  type Palette,
} from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { Folder } from '@/types/document';

interface FolderStripProps {
  folders: Folder[];
  /** Document count per folder id (computed by the parent list screen). */
  counts: Record<string, number>;
  onOpenFolder: (folder: Folder) => void;
  onNewFolder: () => void;
}

const CARD_WIDTH = 112;

const makeStyles = (colors: Palette, shade: 'light' | 'dark') =>
  StyleSheet.create({
    strip: {
      marginBottom: spacing.sm,
    },
    stripContent: {
      paddingHorizontal: spacing.lg,
      paddingRight: spacing.lg * 2 - spacing.sm,
      columnGap: spacing.sm,
    },
    card: {
      width: CARD_WIDTH,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      rowGap: 2,
      boxShadow: cardShadow[shade],
    },
    cardPressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.92,
    },
    cardIconWrap: {
      width: 28,
      height: 28,
      borderRadius: radii.sm,
      backgroundColor: colors.accentPill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    cardName: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 13,
    },
    cardCount: {
      ...typography.badge,
      color: colors.textSecondary,
      marginTop: 1,
    },
    newCard: {
      width: CARD_WIDTH,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: colors.background,
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      rowGap: spacing.xs,
    },
    newCardLabel: {
      ...typography.badge,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });

/**
 * Horizontal folder cards at the top of the Home list: icon chip + name +
 * how many scans are inside, ending with the dashed "+ New folder" card.
 */
export default function FolderStrip({
  folders,
  counts,
  onOpenFolder,
  onNewFolder,
}: FolderStripProps) {
  const { colors, resolved } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, resolved), [colors, resolved]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stripContent}
      style={styles.strip}
    >
      {folders.map((folder) => {
        const count = counts[folder.id] ?? 0;
        return (
          <Pressable
            key={folder.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onOpenFolder(folder);
            }}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open folder ${folder.name}, ${count} documents`}
          >
            <View style={styles.cardIconWrap}>
              <Ionicons name="folder" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardName} numberOfLines={1}>
              {folder.name}
            </Text>
            <Text style={styles.cardCount}>
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
        style={({ pressed }) => [styles.newCard, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel="Create new folder"
      >
        <Ionicons name="add" size={22} color={colors.textSecondary} />
        <Text style={styles.newCardLabel}>New folder</Text>
      </Pressable>
    </ScrollView>
  );
}
