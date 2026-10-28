import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/components/EmptyState';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { useDocuments } from '@/hooks/useDocuments';
import { useAppTheme } from '@/hooks/useAppTheme';
import { isInFolder, sortDocuments } from '@/lib/sorting';
import { requestFoldersView } from '@/lib/viewHint';
import { formatBytes } from '@/lib/fileManager';
import {
  cardShadow,
  radii,
  spacing,
  typography,
  type Palette,
} from '@/constants/theme';
import type { Document } from '@/types/document';

const makeStyles = (colors: Palette, shade: 'light' | 'dark') =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    roundBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surfaceLighter,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roundBtnPressed: {
      transform: [{ scale: 0.92 }],
      opacity: 0.85,
    },
    headerTitle: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 16,
      flex: 1,
      textAlign: 'center',
    },
    headerSide: {
      width: 38,
    },
    doneBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
    },
    doneLabel: {
      ...typography.cardTitle,
      color: colors.primary,
      fontSize: 16,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      ...typography.badge,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg + spacing.md,
      paddingVertical: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      boxShadow: cardShadow[shade],
    },
    rowPressed: {
      opacity: 0.85,
    },
    thumbWrap: {
      width: 44,
      height: 56,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceLighter,
      overflow: 'hidden',
    },
    thumb: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surfaceLighter,
    },
    body: {
      flex: 1,
      marginLeft: spacing.md,
      marginRight: spacing.sm,
    },
    rowTitle: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 15,
    },
    rowMeta: {
      ...typography.badge,
      color: colors.textSecondary,
      marginTop: 3,
    },
    check: {
      marginLeft: spacing.xs,
    },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      alignItems: 'stretch',
    },
    bottomButton: {
      marginTop: spacing.sm,
    },
  });

/**
 * "Add scans" picker: shows every scan not already in the target folder,
 * newest first, each with a round checkbox. "Add N scans" moves the selection
 * into the folder (records only - the PDF files never move) and opens the
 * folder detail; "Skip for now" leaves it empty and returns to the grid.
 */
export default function AddScansScreen() {
  const { colors, resolved } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, resolved), [colors, resolved]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ folderId?: string; mode?: string }>();
  const folderId = typeof params.folderId === 'string' ? params.folderId : '';
  const mode = params.mode === 'create' ? 'create' : 'add';

  const { documents, folders, loading, moveManyToFolder } = useDocuments();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const folder = useMemo(
    () => folders.find((f) => f.id === folderId) ?? null,
    [folders, folderId],
  );

  const candidates = useMemo(
    () => sortDocuments(documents.filter((d) => !isInFolder(d, folderId)), 'newest'),
    [documents, folderId],
  );

  const toggle = useCallback((id: string) => {
    void Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const finishToFolder = useCallback(() => {
    router.replace({ pathname: '/folder/[id]', params: { id: folderId } });
  }, [router, folderId]);

  const confirmAdd = useCallback(async () => {
    if (!folder || selected.size === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      await moveManyToFolder([...selected], folder.id);
      finishToFolder();
    } catch {
      setBusy(false);
    }
  }, [folder, selected, busy, moveManyToFolder, finishToFolder]);

  const done = useCallback(async () => {
    if (!folder) {
      return;
    }
    if (selected.size > 0) {
      await confirmAdd();
    } else {
      finishToFolder();
    }
  }, [folder, selected, confirmAdd, finishToFolder]);

  const skip = useCallback(() => {
    // When the flow started from creating a folder, "Skip for now" means the
    // user should land back on the Folders grid (Home defaults to All files,
    // so leave it a hint).
    if (mode === 'create') {
      requestFoldersView();
    }
    router.back();
  }, [mode, router]);

  const renderItem = useCallback(
    ({ item }: { item: Document }) => {
      const isSelected = selected.has(item.id);
      return (
        <Pressable
          onPress={() => toggle(item.id)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="checkbox"
          accessibilityLabel={`Select ${item.title}`}
          accessibilityState={{ checked: isSelected }}
        >
          <View style={styles.thumbWrap}>
            <Image
              source={{ uri: item.thumbnailUri }}
              style={styles.thumb}
              contentFit="cover"
              recyclingKey={item.id}
              transition={120}
            />
          </View>
          <View style={styles.body}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {item.pageCount} page{item.pageCount === 1 ? '' : 's'} -{' '}
              {formatBytes(item.fileSizeBytes)}
            </Text>
          </View>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isSelected ? colors.primary : colors.border}
            style={styles.check}
          />
        </Pressable>
      );
    },
    [selected, toggle, colors, styles],
  );

  const countLabel = selected.size === 1 ? 'Add 1 scan' : `Add ${selected.size} scans`;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {folder ? `Add scans to ${folder.name}` : 'Add scans'}
          </Text>
          <Pressable
            onPress={() => void done()}
            disabled={!folder || busy}
            style={styles.doneBtn}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !folder ? (
          <EmptyState
            icon="folder-open-outline"
            title="Folder not found"
            subtitle="It may have been deleted."
          />
        ) : (
          <>
            <Text style={styles.hint}>
              {candidates.length === 0
                ? 'Every scan is already in this folder.'
                : 'Tap scans to select them.'}
            </Text>
            <FlatList
              data={candidates}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={7}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.xs,
                paddingBottom: (insets.bottom ?? 0) + 190,
              }}
            />
            <View style={[styles.bottomBar, { paddingBottom: spacing.lg + (insets.bottom ?? 0) }]}>
              <PrimaryButton
                label={countLabel}
                icon="add"
                onPress={() => void confirmAdd()}
                disabled={selected.size === 0 || busy}
                style={styles.bottomButton}
              />
              <SecondaryButton
                label="Skip for now"
                onPress={skip}
                disabled={busy}
                style={styles.bottomButton}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
