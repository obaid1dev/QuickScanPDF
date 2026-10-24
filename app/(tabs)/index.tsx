import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DocumentCard from '@/components/DocumentCard';
import EmptyState from '@/components/EmptyState';
import FolderNameDialog from '@/components/FolderNameDialog';
import FolderStrip from '@/components/FolderStrip';
import FAB from '@/components/FAB';
import AdBanner from '@/components/AdBanner';
import SortBar from '@/components/SortBar';
import { TAB_BAR_ROW_HEIGHT } from '@/components/TabBar';
import { useDocuments, type FolderResult } from '@/hooks/useDocuments';
import { useScanSession } from '@/hooks/useScanSession';
import { useSortPreference } from '@/hooks/useSortPreference';
import { useAppTheme } from '@/hooks/useAppTheme';
import { isInFolder, isUnfiled, sortDocuments } from '@/lib/sorting';
import { savePdfToDevice } from '@/lib/fileManager';
import { maybeRequestRateUs } from '@/lib/rateUs';
import { spacing, typography, type Palette } from '@/constants/theme';
import type { Document } from '@/types/document';

// DocumentCard row height is fixed: 64px thumbnail + 24px vertical padding
// + 8px margin-bottom. Constant, so FlatList can skip measuring entirely.
const ROW_HEIGHT = 96;

const getItemLayout = (
  data: ArrayLike<Document> | null | undefined,
  index: number,
) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index });

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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
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
    sortWrap: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: 184,
    },
    emptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingBottom: 120,
    },
    adSlot: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
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
  const { isActive, clearSession } = useScanSession();
  const { sort, setSort, reload: reloadSort } = useSortPreference();
  const [refreshing, setRefreshing] = useState(false);
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [newFolderError, setNewFolderError] = useState<string | null>(null);

  // Everything that floats near the bottom edge sits above the tab bar.
  const barOffset = TAB_BAR_ROW_HEIGHT + Math.max(insets.bottom, 0);

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
      // Rate-us (in-app review): checked once per focus, after the user has
      // exported a few PDFs. All gates and error absorption live in rateUs.ts.
      maybeRequestRateUs();
      return () => task.cancel();
    }, [refresh, reloadSort]),
  );

  const startNewScan = () => {
    if (isActive) {
      clearSession();
    }
    router.push('/camera');
  };

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

  const renderItem = useCallback(
    ({ item }: { item: Document }) => (
      <DocumentCard
        document={item}
        onRename={rename}
        onDownload={downloadDocument}
        onShare={shareDocument}
        onDelete={deleteDocument}
        onPress={openDocument}
        folders={folders}
        onMove={(doc, folderId) => {
          void Haptics.selectionAsync();
          moveDocument(doc.id, folderId).catch(() => undefined);
        }}
        onCreateAndMove={createAndMove}
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
    ],
  );

  // Home shows Unfiled documents only — docs missing `folderId` (Release-1
  // records and new scans) land here automatically. Memoised so scrolling
  // doesn't re-run the filter+sort.
  const unfiledDocs = useMemo(
    () => sortDocuments(documents.filter(isUnfiled), sort),
    [documents, sort],
  );

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

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>QuickScan PDF</Text>
            <Text style={styles.subtitle}>{totalStorageLabel} used on device</Text>
          </View>
        </View>

        <FolderStrip
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

        {!loading ? (
          <View style={styles.sortWrap}>
            <SortBar value={sort} onChange={setSort} />
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : documents.length === 0 ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <EmptyState
                icon="document-text-outline"
                title="No scans yet"
                subtitle="Tap the camera button below to scan your first document."
              />
            }
            contentContainerStyle={styles.emptyContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          />
        ) : unfiledDocs.length === 0 ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <EmptyState
                icon="folder-open-outline"
                title="Everything is filed"
                subtitle="Open a folder above to see its documents. New scans will appear here."
              />
            }
            contentContainerStyle={styles.emptyContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          />
        ) : (
          <FlatList
            data={unfiledDocs}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            getItemLayout={getItemLayout}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </SafeAreaView>

      <View style={[styles.adSlot, { bottom: barOffset + 32 }]}>
        <AdBanner />
      </View>
      <FAB onPress={startNewScan} bottom={barOffset + 28} />

      <FolderNameDialog
        visible={newFolderVisible}
        title="New folder"
        confirmLabel="Create"
        error={newFolderError}
        onSubmit={(name) => void submitNewFolder(name)}
        onCancel={() => setNewFolderVisible(false)}
      />
    </View>
  );
}
