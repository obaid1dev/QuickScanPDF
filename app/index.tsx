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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import DocumentCard from '@/components/DocumentCard';
import EmptyState from '@/components/EmptyState';
import FAB from '@/components/FAB';
import AdBanner from '@/components/AdBanner';
import { useDocuments } from '@/hooks/useDocuments';
import { useScanSession } from '@/hooks/useScanSession';
import { useAppTheme } from '@/hooks/useAppTheme';
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
    gear: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gearPressed: {
      transform: [{ scale: 0.94 }],
      opacity: 0.7,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: 120,
    },
    emptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingBottom: 80,
    },
    adSlot: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 96,
      alignItems: 'center',
    },
  });

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const {
    documents,
    loading,
    refresh,
    rename,
    remove,
    totalStorageLabel,
  } = useDocuments();
  const { isActive, clearSession } = useScanSession();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Defer the storage-usage reload until the tab transition has finished
      // so it doesn't fight the screen-enter animation for the JS thread.
      const task = InteractionManager.runAfterInteractions(() => {
        refresh().catch(() => undefined);
      });
      // Rate-us (in-app review): checked once per focus, after the user has
      // exported a few PDFs. All gates and error absorption live in rateUs.ts.
      maybeRequestRateUs();
      return () => task.cancel();
    }, [refresh]),
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

  const renderItem = useCallback(
    ({ item }: { item: Document }) => (
      <DocumentCard
        document={item}
        onRename={rename}
        onDownload={downloadDocument}
        onShare={shareDocument}
        onDelete={deleteDocument}
        onPress={openDocument}
      />
    ),
    [rename, downloadDocument, shareDocument, deleteDocument, openDocument],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>QuickScan PDF</Text>
            <Text style={styles.subtitle}>{totalStorageLabel} used on device</Text>
          </View>
          <Pressable
            hitSlop={8}
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

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
        ) : (
          <FlatList
            data={documents}
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

      <View style={styles.adSlot}>
        <AdBanner />
      </View>
      <FAB onPress={startNewScan} />
    </View>
  );
}
