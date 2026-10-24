import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STORAGE_KEYS } from '@/constants/config';
import { getItem } from '@/lib/storage';
import { getImagePixelSize } from '@/lib/imageProcessing';
import { markDocumentOpened } from '@/lib/activity';
import AdBanner from '@/components/AdBanner';
import OcrFlowView from '@/components/OcrFlowView';
import { useInterstitialAd } from '@/hooks/useInterstitialAd';
import { useInterstitialOnBack } from '@/hooks/useInterstitialOnBack';
import { useOcrFlow } from '@/hooks/useOcrFlow';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ADS_ENABLED, AD_UNIT_IDS } from '@/constants/config';
import {
  cardShadow,
  radii,
  spacing,
  typography,
  type Palette,
} from '@/constants/theme';
import { savePdfToDevice } from '@/lib/fileManager';
import type { Document } from '@/types/document';

const makeStyles = (colors: Palette, shade: 'light' | 'dark') =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerSafe: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    headerBody: {
      flex: 1,
      marginHorizontal: spacing.sm,
    },
    headerTitle: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 16,
    },
    headerMeta: {
      ...typography.badge,
      color: colors.textSecondary,
      marginTop: 1,
    },
    roundBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surfaceLighter,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      columnGap: spacing.sm,
    },
    pressed: {
      opacity: 0.7,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
    },
    pageCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      marginBottom: spacing.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      boxShadow: cardShadow[shade],
    },
    pageImage: {
      width: '100%',
      aspectRatio: 1 / 1.414,
      backgroundColor: colors.surface,
    },
    pageBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: colors.scrim,
      borderRadius: radii.round,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    pageBadgeText: {
      color: colors.onScrim,
      fontSize: 11,
      fontWeight: '600',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.background,
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      marginTop: spacing.md,
    },
    emptyText: {
      ...typography.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    primaryBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: spacing.xl,
      paddingVertical: 12,
    },
    primaryBtnText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    adSlot: {
      backgroundColor: colors.background,
      paddingTop: spacing.sm,
    },
  });

export default function ViewDocumentScreen() {
  const { colors, resolved } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, resolved), [colors, resolved]);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageSizes, setPageSizes] = useState<number[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const list = await getItem<Document[]>(STORAGE_KEYS.documents);
      const found = (list ?? []).find((d) => d.id === id) ?? null;
      if (!mountedRef.current) {
        return;
      }
      setDoc(found);
      setLoading(false);
      // "Recently opened" bookkeeping - persist only, so no repaint loop.
      if (found) {
        void markDocumentOpened(found.id);
      }
      if (found?.pages?.length) {
        const ratios = await Promise.all(
          found.pages.map(async (uri) => {
            const size = await getImagePixelSize(uri);
            return size && size.width > 0 ? size.height / size.width : 1.414;
          }),
        );
        if (mountedRef.current) {
          setPageSizes(ratios);
        }
      }
    })();
  }, [id]);

  const shareDoc = useCallback(() => {
    if (!doc) {
      return;
    }
    void Sharing.shareAsync(doc.pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: doc.title,
    }).catch(() => {
      Alert.alert(
        'Could not share',
        'The PDF file could not be opened. It may have been moved or deleted.',
      );
    });
  }, [doc]);

  const downloadDoc = useCallback(async () => {
    if (!doc) {
      return;
    }
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
  }, [doc]);

  const interstitial = useInterstitialAd(doc != null);
  const ocr = useOcrFlow(ADS_ENABLED);

  const leaveViewer = useCallback(() => {
    router.back();
  }, [router]);
  const handleBack = useInterstitialOnBack(
    interstitial,
    leaveViewer,
    doc != null,
  );

  const pressBack = useCallback(() => {
    void Haptics.selectionAsync();
    handleBack();
  }, [handleBack]);

  const extractAll = useCallback(() => {
    if (!doc?.pages?.length) {
      return;
    }
    void Haptics.selectionAsync();
    ocr.requestOcr(doc.pages, doc.title);
  }, [doc, ocr]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!doc) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="file-tray-outline" size={44} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>Scan not found</Text>
        <Text style={styles.emptyText}>
          This scan may have been stored on another device.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const pages = doc.pages ?? [];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Pressable
            hitSlop={8}
            onPress={pressBack}
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {doc.title}
            </Text>
            <Text style={styles.headerMeta}>
              {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {pages.length > 0 ? (
              <Pressable
                hitSlop={8}
                onPress={extractAll}
                style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
                accessibilityLabel="Extract text from this document"
              >
                <Ionicons name="text-outline" size={20} color={colors.textPrimary} />
              </Pressable>
            ) : null}
            <Pressable
              hitSlop={8}
              onPress={() => void downloadDoc()}
              style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
              accessibilityLabel="Download PDF"
            >
              <Ionicons name="download-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          <Pressable
            hitSlop={8}
            onPress={shareDoc}
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            accessibilityLabel="Share PDF"
          >
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>

    <OcrFlowView flow={ocr} />

      {pages.length > 0 ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {pages.map((uri, index) => (
            <View key={uri} style={styles.pageCard}>
              <Image
                source={{ uri }}
                style={[
                  styles.pageImage,
                  pageSizes[index] != null && { aspectRatio: 1 / pageSizes[index] },
                ]}
                contentFit="contain"
                recyclingKey={uri}
                transition={150}
              />
              <View style={styles.pageBadge}>
                <Text style={styles.pageBadgeText}>
                  {index + 1} / {pages.length}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.centered}>
          <Ionicons name="documents-outline" size={44} color={colors.textSecondary} />
          <Text style={styles.emptyText}>
            Page previews are not available for this scan.
          </Text>
          <Pressable onPress={shareDoc} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText}>Share PDF</Text>
          </Pressable>
        </View>
      )}

      {doc && ADS_ENABLED && pages.length > 0 ? (
        <SafeAreaView edges={['bottom']} style={styles.adSlot}>
          <AdBanner unitId={AD_UNIT_IDS.viewerBanner} />
        </SafeAreaView>
      ) : null}
    </View>
  );
}
