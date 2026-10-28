import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ActionMenu from '@/components/ActionMenu';
import AdBanner from '@/components/AdBanner';
import DocumentCard from '@/components/DocumentCard';
import EmptyState from '@/components/EmptyState';
import FolderNameDialog from '@/components/FolderNameDialog';
import FolderTileGrid from '@/components/FolderTileGrid';
import ViewToggle, { type HomeView } from '@/components/ViewToggle';
import { BAR_HEIGHT, BAR_BOTTOM_GAP, CAMERA_BUTTON_RISE } from '@/components/TabBar';
import { useDocuments, type FolderResult } from '@/hooks/useDocuments';
import { useSortPreference } from '@/hooks/useSortPreference';
import { useAppTheme } from '@/hooks/useAppTheme';
import { isInFolder, sortDocuments, type SortOption } from '@/lib/sorting';
import { groupDocumentsByDate } from '@/lib/dateGroups';
import { consumeFoldersView } from '@/lib/viewHint';
import { savePdfToDevice } from '@/lib/fileManager';
import { maybeRequestRateUs } from '@/lib/rateUs';
import {
  radii,
  spacing,
  typography,
  type Palette,
} from '@/constants/theme';
import type { Document } from '@/types/document';

// Row constants for the FlatList: a section header strip and a document card
// (64px thumbnail + 24px vertical padding + 8px bottom margin).
const ROW_HEIGHT = 96;
const HEADER_ROW = 44;

/**
 * Ad slot metrics (Fix 5): the slot's bottom edge sits 12dp above the TOP of
 * the nav bar's container - computed from the bar's exported height plus the
 * device's safe-area bottom inset, never a fixed screen offset. The camera
 * button rises 22dp above that same top edge, so the slot's visible banner
 * content pads up by 22 - 12 = 10dp and can never overlap the button; the
 * extra 10dp of the slot stays transparent. The full area is reserved, so
 * the list never jumps when the ad loads or fails.
 */
const AD_SLOT_HEIGHT = 50;
const AD_SLOT_GAP_ABOVE_BAR = 12;
const AD_SLOT_BUTTON_CLEAR = CAMERA_BUTTON_RISE - AD_SLOT_GAP_ABOVE_BAR; // 10

interface HeaderRow {
  kind: 'header';
  key: string;
  label: string;
}
interface DocRow {
  kind: 'doc';
  key: string;
  doc: Document;
}
type ListRow = HeaderRow | DocRow;

const SORT_MENU: Array<{ value: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'newest', label: 'Newest first', icon: 'calendar-outline' },
  { value: 'oldest', label: 'Oldest first', icon: 'calendar-clear-outline' },
  { value: 'name', label: 'Name A-Z', icon: 'text-outline' },
  { value: 'size', label: 'Size (largest first)', icon: 'bar-chart-outline' },
  { value: 'recent', label: 'Recently opened', icon: 'time-outline' },
];

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safe: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      // Fix 4: the SafeAreaView reports the device's top safe-area inset
      // (small - the status bar is hidden everywhere); the header adds only
      // these 12dp, so nothing else adds space above the title.
      paddingTop: spacing.md,
      // 16dp between the header and the All files / Folders toggle.
      paddingBottom: spacing.lg,
    },
    gearBtn: {
      width: 40,
      height: 40,
      // Same surface style as the sort pill: muted fill with a hairline border.
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surfaceLighter,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gearBtnPressed: {
      transform: [{ scale: 0.92 }],
      opacity: 0.85,
    },
    title: {
      ...typography.screenTitle,
      color: colors.textPrimary,
    },
    subtitle: {
      ...typography.secondary,
      color: colors.textSecondary,
      marginTop: 4,
    },
    toggleWrap: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xs,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.xs,
      backgroundColor: colors.surfaceLighter,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.round,
      paddingHorizontal: spacing.md,
      height: 32,
    },
    sortBtnPressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.9,
    },
    sortBtnLabel: {
      ...typography.badge,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    sectionHeader: {
      height: HEADER_ROW,
      justifyContent: 'flex-end',
      paddingBottom: 6,
      paddingHorizontal: spacing.xs,
    },
    sectionLabel: {
      ...typography.badge,
      color: colors.textSecondary,
      fontWeight: '700',
      fontSize: 12,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listBase: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    foldersPad: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: 120,
    },
    foldersCentered: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    adSlot: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: AD_SLOT_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: radii.md,
    },
  });

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    documents,
    folders,
    loading,
    refresh,
    rename,
    remove,
    addFolder,
    moveDocument,
    totalStorageLabel,
  } = useDocuments();
  const { sort, setSort, reload: reloadSort } = useSortPreference();
  const [view, setView] = useState<HomeView>('files');
  const [refreshing, setRefreshing] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [newFolderError, setNewFolderError] = useState<string | null>(null);

  // Bar top edge, from the navigator style (bottom inset above the gesture
  // area) and the bar's own constants - measured values, not screen guesses.
  const barTopOffset = Math.max(insets.bottom, 0) + BAR_BOTTOM_GAP + BAR_HEIGHT;
  const adSlotBottom = barTopOffset + AD_SLOT_GAP_ABOVE_BAR;
  const slotHeight = AD_SLOT_HEIGHT + AD_SLOT_BUTTON_CLEAR;
  // List must scroll clear of the whole reserved slot + breathing room.
  const listPadding = adSlotBottom + slotHeight + 24;

  useFocusEffect(
    useCallback(() => {
      // Defer the storage-usage reload until the tab transition has finished
      // so it doesn't fight the screen-enter animation for the JS thread.
      const task = InteractionManager.runAfterInteractions(() => {
        refresh().catch(() => undefined);
      });
      // Re-read the persisted sort choice: the Home tab stays mounted while a
      // Folder screen (pushed over it) may have changed it.
      reloadSort();
      // A "Skip for now" from the Add scans flow wants the Folders view.
      if (consumeFoldersView()) {
        setView('folders');
      }
      // Rate-us (in-app review): checked once per focus, after the user has
      // exported a few PDFs. All gates and error absorption live in rateUs.ts.
      maybeRequestRateUs();
      return () => task.cancel();
    }, [refresh, reloadSort]),
  );

  const openDocument = useCallback((doc: Document) => {
    router.push({ pathname: '/viewer', params: { id: doc.id } });
  }, [router]);

  const shareDocument = useCallback((doc: Document) => {
    void Sharing.shareAsync(doc.pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: doc.title,
    }).catch(() => {
      Alert.alert(
        'Could not share',
        'The PDF file could not be opened. It may have been moved or deleted.',
      );
    });
  }, []);

  const downloadDocument = useCallback(async (doc: Document) => {
    void Haptics.selectionAsync();
    try {
      if (Platform.OS === 'android') {
        const outcome = await savePdfToDevice(doc.title, { uri: doc.pdfUri });
        if (outcome === 'cancelled') {
          return;
        }
        Alert.alert(
          'Downloaded',
          `"${doc.title}" was saved to your device's Downloads folder.`,
        );
      } else {
        // iOS has no SAF picker; the share sheet's "Save to Files" is the
        // download path.
        await Sharing.shareAsync(doc.pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: doc.title,
        });
      }
    } catch (e) {
      Alert.alert(
        'Download failed',
        e instanceof Error
          ? e.message
          : 'Could not download the PDF to your device.',
      );
    }
  }, []);

  const deleteDocument = useCallback((id: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    remove(id).catch(() => undefined);
  }, [remove]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => undefined);
    setRefreshing(false);
  };

  /**
   * One-step "create folder + move" from the document card's move sheet.
   * The created folder id comes straight from the hook, so the move targets
   * a folder that definitely exists.
   */
  const createAndMove = useCallback(
    async (doc: Document, name: string): Promise<FolderResult['status']> => {
      try {
        const result = await addFolder(name);
        if (result.status !== 'ok') {
          return result.status;
        }
        await moveDocument(doc.id, result.folder.id);
        return 'ok';
      } catch {
        return 'error';
      }
    },
    [addFolder, moveDocument],
  );

  /**
   * "Newest first" IS the date-grouped view; everything else is a flat list
   * sorted by the chosen option. The choice is persisted (useSortPreference).
   */
  const sortActive = sort !== 'newest';

  const listRows = useMemo<Array<ListRow>>(() => {
    if (sortActive) {
      return sortDocuments(documents, sort).map((doc) => ({
        kind: 'doc',
        key: doc.id,
        doc,
      }));
    }
    const rows: Array<ListRow> = [];
    for (const section of groupDocumentsByDate(documents, Date.now())) {
      rows.push({ kind: 'header', key: `header_${section.key}`, label: section.label });
      for (const doc of section.docs) {
        rows.push({ kind: 'doc', key: doc.id, doc });
      }
    }
    return rows;
  }, [documents, sort, sortActive]);

  const rowLayouts = useMemo(() => {
    let offset = 0;
    const offsets = listRows.map((row) => {
      const entry = {
        length: row.kind === 'header' ? HEADER_ROW : ROW_HEIGHT,
        offset,
        index: 0,
      };
      offset += entry.length;
      return entry;
    });
    offsets.forEach((entry, index) => {
      entry.index = index;
    });
    return offsets;
  }, [listRows]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<ListRow> | null | undefined, index: number) =>
      rowLayouts[index],
    [rowLayouts],
  );

  const folderNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const folder of folders) {
      map[folder.id] = folder.name;
    }
    return map;
  }, [folders]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const folder of folders) {
      counts[folder.id] = 0;
    }
    for (const doc of documents) {
      for (const folder of folders) {
        if (isInFolder(doc, folder.id)) {
          counts[folder.id] += 1;
        }
      }
    }
    return counts;
  }, [documents, folders]);

  const submitNewFolder = async (name: string) => {
    const result = await addFolder(name);
    if (result.status === 'ok') {
      setNewFolderVisible(false);
      setNewFolderError(null);
      // Created: straight into the Add scans flow for the new folder.
      router.push({
        pathname: '/add-scans',
        params: { folderId: result.folder.id, mode: 'create' },
      });
      return;
    }
    setNewFolderError(
      result.status === 'duplicate'
        ? 'A folder with that name already exists.'
        : result.status === 'invalid'
          ? 'Please give the folder a name.'
          : 'Something went wrong. Please try again.',
    );
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={colors.primary}
    />
  );

  const renderCard = useCallback(
    (doc: Document) => (
      <DocumentCard
        document={doc}
        onRename={rename}
        onDownload={downloadDocument}
        onShare={shareDocument}
        onDelete={deleteDocument}
        onPress={openDocument}
        folders={folders}
        onMove={(target, folderId) => {
          void Haptics.selectionAsync();
          moveDocument(target.id, folderId).catch(() => undefined);
        }}
        onCreateAndMove={createAndMove}
        folderName={doc.folderId ? folderNameById[doc.folderId] : undefined}
      />
    ),
    [
      rename,
      downloadDocument,
      shareDocument,
      deleteDocument,
      openDocument,
      folders,
      moveDocument,
      createAndMove,
      folderNameById,
    ],
  );

  const renderRow = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.kind === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{item.label}</Text>
          </View>
        );
      }
      return renderCard(item.doc);
    },
    [renderCard, styles],
  );

  const sortButtonLabel = SORT_MENU.find((o) => o.value === sort)?.label ?? 'Sorting';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>QuickScan PDF</Text>
            <Text style={styles.subtitle}>{totalStorageLabel} used on device</Text>
          </View>
          {/* Settings now opens from here - it left the bottom bar (Option B,
              bar = Home | camera | Tools). The screen and route are the same. */}
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              router.push('/settings');
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            style={({ pressed }) => [styles.gearBtn, pressed && styles.gearBtnPressed]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.toggleWrap}>
          <ViewToggle view={view} onChange={setView} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : view === 'files' ? (
          <>
            <View style={styles.sortRow}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSortMenuVisible(true);
                }}
                style={({ pressed }) => [
                  styles.sortBtn,
                  pressed && styles.sortBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Change sorting"
              >
                <Ionicons name="options-outline" size={16} color={colors.primary} />
                <Text style={styles.sortBtnLabel}>{sortButtonLabel}</Text>
              </Pressable>
            </View>
            {documents.length === 0 ? (
              <FlatList
                data={[] as ListRow[]}
                renderItem={() => null}
                ListEmptyComponent={
                  <EmptyState
                    icon="document-text-outline"
                    title="No scans yet"
                    subtitle="Tap the camera button below to scan your first document."
                  />
                }
                contentContainerStyle={[styles.listBase, { paddingBottom: listPadding, flexGrow: 1, justifyContent: 'center' }]}
                refreshControl={refreshControl}
              />
            ) : (
              <FlatList
                data={listRows}
                keyExtractor={(item) => item.key}
                renderItem={renderRow}
                contentContainerStyle={[styles.listBase, { paddingBottom: listPadding }]}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={7}
                removeClippedSubviews
                getItemLayout={getItemLayout}
                refreshControl={refreshControl}
              />
            )}
          </>
        ) : (
          <ScrollView
            contentContainerStyle={
              folders.length === 0
                ? [styles.foldersCentered, { paddingBottom: listPadding }]
                : styles.foldersPad
            }
            refreshControl={refreshControl}
            showsVerticalScrollIndicator={false}
          >
            <FolderTileGrid
              folders={folders}
              counts={folderCounts}
              onOpenFolder={(folder) =>
                router.push({ pathname: '/folder/[id]', params: { id: folder.id } })
              }
              onNewFolder={() => {
                setNewFolderError(null);
                setNewFolderVisible(true);
              }}
            />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Fixed ad slot: bottom edge 12dp above the bar's top edge; the
          visible banner pads up 10dp more so it can never overlap the
          risen camera button. Height reserved -> no layout jump. */}
      <View
        style={[
          styles.adSlot,
          { bottom: adSlotBottom, height: slotHeight, paddingBottom: AD_SLOT_BUTTON_CLEAR },
        ]}
      >
        <AdBanner />
      </View>

      <FolderNameDialog
        visible={newFolderVisible}
        title="New folder"
        confirmLabel="Create"
        error={newFolderError}
        onSubmit={(name) => void submitNewFolder(name)}
        onCancel={() => setNewFolderVisible(false)}
      />

      <ActionMenu
        visible={sortMenuVisible}
        title="Sort by"
        options={SORT_MENU.map((option) => ({
          icon: option.icon,
          label: option.label,
          selected: sort === option.value,
          onPress: () => void setSort(option.value),
        }))}
        onClose={() => setSortMenuVisible(false)}
      />
    </View>
  );
}
