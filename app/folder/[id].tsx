import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ActionMenu from '@/components/ActionMenu';
import ConfirmDialog from '@/components/ConfirmDialog';
import DocumentCard from '@/components/DocumentCard';
import EmptyState from '@/components/EmptyState';
import FolderNameDialog from '@/components/FolderNameDialog';
import FAB from '@/components/FAB';
import { useDocuments, type FolderResult } from '@/hooks/useDocuments';
import { useAppTheme } from '@/hooks/useAppTheme';
import { isInFolder, sortDocuments } from '@/lib/sorting';
import { savePdfToDevice } from '@/lib/fileManager';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import type { Document } from '@/types/document';

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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
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
    folderTitle: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 17,
      flex: 1,
      marginHorizontal: spacing.xs,
    },
    countNote: {
      ...typography.badge,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg + spacing.md,
      paddingBottom: spacing.md,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      // Keep the last card clear of the docked Add scans FAB.
      paddingBottom: 120,
    },
  });

/**
 * A single folder: its documents (same card as "All files"), always sorted
 * newest first, with a floating Add scans button and a "..." menu with Rename
 * and Delete. Deliberately NO interstitial hook - folder navigation must not
 * count as "returning home" (ads fire only from viewer/share backs).
 */
export default function FolderScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const {
    documents,
    folders,
    loading,
    refresh,
    rename,
    remove,
    addFolder,
    renameFolder,
    removeFolder,
    moveDocument,
  } = useDocuments();

  const [menuVisible, setMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const folder = useMemo(
    () => folders.find((f) => f.id === id) ?? null,
    [folders, id],
  );

  // Folder detail is always newest first (prompt section 1).
  const folderDocs = useMemo(
    () => sortDocuments(documents.filter((d) => isInFolder(d, id)), 'newest'),
    [documents, id],
  );

  useFocusEffect(
    useCallback(() => {
      // Returning from the viewer (a "Recently opened" update) or from the
      // Add scans flow: re-read the documents.
      refresh().catch(() => undefined);
    }, [refresh]),
  );

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
      const outcome = await savePdfToDevice(doc.title, { uri: doc.pdfUri });
      if (outcome === 'cancelled') {
        return;
      }
      Alert.alert(
        'Downloaded',
        `"${doc.title}" was saved to your device's Downloads folder.`,
      );
    } catch (e) {
      Alert.alert(
        'Download failed',
        e instanceof Error ? e.message : 'Could not download the PDF to your device.',
      );
    }
  }, []);

  const deleteDocument = useCallback(
    (docId: string) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      remove(docId).catch(() => undefined);
    },
    [remove],
  );

  const openDocument = useCallback(
    (doc: Document) => {
      router.push({ pathname: '/viewer', params: { id: doc.id } });
    },
    [router],
  );

  const openAddScans = useCallback(() => {
    router.push({ pathname: '/add-scans', params: { folderId: id, mode: 'add' } });
  }, [router, id]);

  /**
   * One-step "create folder + move" from the document card's move sheet.
   * The created folder id comes straight from the hook, so the move targets
   * a folder that definitely exists. Moving a doc into THIS folder removes
   * it from this screen's list - correct and immediately visible.
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

  const submitRename = async (name: string) => {
    if (!folder) {
      return;
    }
    const result: FolderResult = await renameFolder(folder.id, name);
    if (result.status === 'ok') {
      setRenameVisible(false);
      setRenameError(null);
      return;
    }
    setRenameError(
      result.status === 'duplicate'
        ? 'A folder with that name already exists.'
        : result.status === 'invalid'
          ? 'Please give the folder a name.'
          : 'Something went wrong. Please try again.',
    );
  };

  const confirmDelete = async () => {
    setDeleteVisible(false);
    await removeFolder(id).catch(() => undefined);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

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
          <Text style={styles.folderTitle} numberOfLines={1}>
            {folder?.name ?? 'Folder'}
          </Text>
          <Pressable
            hitSlop={6}
            onPress={() => setMenuVisible(true)}
            accessibilityLabel="Folder options"
            style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
          >
            <Ionicons name="ellipsis-vertical" size={19} color={colors.textPrimary} />
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
            <Text style={styles.countNote}>
              {folderDocs.length} document{folderDocs.length === 1 ? '' : 's'}
            </Text>
            {folderDocs.length === 0 ? (
              <EmptyState
                icon="folder-open-outline"
                title="This folder is empty"
                subtitle="Move documents here from the Home screen, or add some right away."
                action={{ label: 'Add scans', onPress: openAddScans }}
              />
            ) : (
              <FlatList
                data={folderDocs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <DocumentCard
                    document={item}
                    onRename={rename}
                    onDownload={downloadDocument}
                    onShare={shareDocument}
                    onDelete={deleteDocument}
                    onPress={openDocument}
                    folders={folders}
                    onMove={(doc, targetId) => {
                      void Haptics.selectionAsync();
                      moveDocument(doc.id, targetId).catch(() => undefined);
                    }}
                    onCreateAndMove={createAndMove}
                  />
                )}
                contentContainerStyle={styles.listContent}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={7}
                removeClippedSubviews
                getItemLayout={getItemLayout}
              />
            )}
          </>
        )}
      </SafeAreaView>

      {/* Floating Add scans button, above the Android gesture area. */}
      <FAB
        onPress={openAddScans}
        icon="add"
        label="Add scans to this folder"
        bottom={Math.max(insets.bottom, 0) + 16}
      />

      <ActionMenu
        visible={menuVisible}
        title={folder?.name ?? 'Folder'}
        options={[
          {
            icon: 'create-outline',
            label: 'Rename',
            onPress: () => {
              setRenameError(null);
              setRenameVisible(true);
            },
          },
          {
            icon: 'trash-outline',
            label: 'Delete folder',
            danger: true,
            onPress: () => setDeleteVisible(true),
          },
        ]}
        onClose={() => setMenuVisible(false)}
      />

      <FolderNameDialog
        visible={renameVisible}
        title="Rename folder"
        initialName={folder?.name ?? ''}
        error={renameError}
        onSubmit={(name) => void submitRename(name)}
        onCancel={() => setRenameVisible(false)}
      />

      <ConfirmDialog
        visible={deleteVisible}
        icon="trash-outline"
        title="Delete this folder?"
        message="Documents inside will move to Unfiled. Nothing will be deleted."
        confirmLabel="Delete folder"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteVisible(false)}
      />
    </View>
  );
}
