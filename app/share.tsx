import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProcessingLoader from '@/components/ProcessingLoader';
import { useScanSession } from '@/hooks/useScanSession';
import { useDocuments } from '@/hooks/useDocuments';
import { generateIdCardPdf, generatePdfFromImages } from '@/lib/pdfGenerator';
import {
  getImagePixelSize,
  makeThumbnail,
  preparePageForPdf,
  resizeImageToMax,
} from '@/lib/imageProcessing';
import {
  copyFileToScans,
  copyPagesToScans,
  getFileSizeBytes,
  moveFileToScans,
  savePdfToDevice,
  savePdfToScans,
  generateUniqueFileName,
} from '@/lib/fileManager';
import { defaultScanTitle, idCardTitle } from '@/lib/format';
import { useInterstitialAd, incrementExportCount } from '@/hooks/useInterstitialAd';
import { useInterstitialOnBack } from '@/hooks/useInterstitialOnBack';
import { colors, radii, spacing, typography } from '@/constants/theme';
import type { Document } from '@/types/document';

type Stage = 'generating' | 'done' | 'error';

interface ResultInfo {
  doc: Document;
  base64?: string | null;
}

export default function ShareScreen() {
  const router = useRouter();
  const { pages, isActive, clearSession, scanMode } = useScanSession();
  const { create } = useDocuments();

  // ID Card mode exports ONE A4 page with both sides stacked; every other mode
  // keeps the original one-image-per-page document layout.
  const isIdCard = scanMode === 'id_card';

  const [stage, setStage] = useState<Stage>('generating');
  const [progress, setProgress] = useState('Generating your PDF…');
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Never load the interstitial while the PDF is being generated; only once
  // the export has succeeded and the success screen is shown.
  const interstitial = useInterstitialAd(stage === 'done');

  const leaveHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  // Unified leave path — back arrow AND Android hardware back both flow
  // through here, so the interstitial fires on every back-to-home regardless
  // of which one the user triggered. Only armed once generation is done.
  const handleBack = useInterstitialOnBack(
    interstitial,
    leaveHome,
    stage === 'done',
  );

  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const generate = async () => {
    if (!isActive) {
      router.replace('/');
      return;
    }
    attemptRef.current += 1;
    setStage('generating');
    setProgress('Generating your PDF…');
    startedRef.current = true;

    try {
      // ID Card mode: downscale the card scans (aspect preserved, EXIF baked)
      // and let the HTML fit them into card-shaped slots. Document mode keeps
      // the full-bleed A4 letterbox so each page fills the sheet.
      const pageUris = isIdCard
        ? (
            await Promise.all(
              pages.map((p) => resizeImageToMax(p.processedUri, 1600, 0.85)),
            )
          ).slice(0, 2)
        : await Promise.all(
            pages.map((p) => preparePageForPdf(p.processedUri)),
          );
      // Real pixel sizes so the PDF page images are centered with exact pixel
      // offsets (print engines on Android ignore CSS centering).
      const imageSizes = await Promise.all(
        pageUris.map((uri) => getImagePixelSize(uri)),
      );
      const pdf = isIdCard
        ? await generateIdCardPdf(pageUris, setProgress, imageSizes)
        : await generatePdfFromImages(pageUris, setProgress, imageSizes);

      if (__DEV__) {
        console.log(
          `[QuickScan] printToFileAsync -> uri=${pdf.uri} pages=${pdf.numberOfPages} base64=${pdf.base64 ? `${pdf.base64.length} chars` : 'none'}`,
        );
      }

      // ID Card exports are named after the export (ID_Card_YYYY_MM_DD_HHmm.pdf)
      // instead of the random suffix the document flow uses.
      const docTitle = isIdCard ? idCardTitle() : defaultScanTitle();
      const pdfName = isIdCard
        ? `${docTitle}.pdf`
        : generateUniqueFileName('Scan', 'pdf');
      const docId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

      // Persist the PDF into the Scans folder. Sources are tried in order:
      //   1. base64 bytes (native, permission-free) written directly,
      //   2. move/copy of the `cache/Print/` file (works in dev/standalone
      //      builds, but Expo Go on Android denies reads of that path),
      //   3. the un-moved print URI as a last resort so Convert never fails
      //      on a persistence quirk and the user can always share.
      let pdfUri: string;
      if (pdf.base64) {
        try {
          pdfUri = await savePdfToScans(pdfName, pdf.base64);
        } catch (persistErr) {
          if (__DEV__) {
            console.log(
              `[QuickScan] savePdfToScans failed (${persistErr instanceof Error ? persistErr.message : persistErr}); falling back to move/copy`,
            );
          }
          try {
            pdfUri = await moveFileToScans(pdf.uri, pdfName);
          } catch (moveErr) {
            if (__DEV__) {
              console.log(
                `[QuickScan] moveFileToScans failed (${moveErr instanceof Error ? moveErr.message : moveErr}); using print cache URI`,
              );
            }
            pdfUri = pdf.uri;
          }
        }
      } else {
        try {
          pdfUri = await moveFileToScans(pdf.uri, pdfName);
        } catch {
          pdfUri = pdf.uri;
        }
      }

      let thumbnailUri = pdfUri;
      if (pageUris[0]) {
        try {
          thumbnailUri = await copyFileToScans(
            await makeThumbnail(pageUris[0]),
            `thumb_${pdfName.replace(/\.pdf$/i, '')}.jpg`,
          );
        } catch {
          thumbnailUri = pdfUri;
        }
      }

      const doc: Document = {
        id: docId,
        title: docTitle,
        pdfUri,
        thumbnailUri,
        pageCount: pdf.numberOfPages ?? pages.length,
        fileSizeBytes: await getFileSizeBytes(pdfUri),
        createdAt: Date.now(),
        pages: await copyPagesToScans(pageUris, docId),
      };

      await create(doc);
      clearSession();

      if (mountedRef.current) {
        setResult({ doc, base64: pdf.base64 });
        setStage('done');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      if (!mountedRef.current) {
        return;
      }
      // Transient print-cache failures are common inside Expo Go on Android;
      // regenerate the PDF once before surfacing an error.
      if (attemptRef.current < 2) {
        if (__DEV__) {
          console.log(
            `[QuickScan] PDF generation attempt ${attemptRef.current} failed (${e instanceof Error ? e.message : e}); regenerating once…`,
          );
        }
        setTimeout(() => {
          if (mountedRef.current) {
            generate().catch(() => undefined);
          }
        }, 450);
        return;
      }
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      setErrorMsg(message);
      setStage('error');
    }
  };

  useEffect(() => {
    if (!startedRef.current) {
      generate().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sharePdf = () => {
    if (!result) {
      return;
    }
    void Sharing.shareAsync(result.doc.pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: result.doc.title,
    });
  };

  const downloadPdf = async () => {
    if (!result) {
      return;
    }
    void Haptics.selectionAsync();
    try {
      if (Platform.OS === 'android') {
        const outcome = await savePdfToDevice(result.doc.title, {
          uri: result.doc.pdfUri,
          base64: result.base64 ?? undefined,
        });
        if (outcome === 'cancelled') {
          return;
        }
        Alert.alert(
          'Downloaded',
          `"${result.doc.title}" was saved to your device's Downloads folder.`,
        );
      } else {
        // iOS has no SAF picker; the share sheet's "Save to Files" is the
        // download path.
        await Sharing.shareAsync(result.doc.pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: result.doc.title,
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
  };

  if (stage === 'generating') {
    return (
      <SafeAreaView style={styles.generatingWrap}>
        <ProcessingLoader message={progress} />
      </SafeAreaView>
    );
  }

  if (stage === 'error') {
    return (
      <SafeAreaView style={styles.generatingWrap}>
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorTitle}>PDF generation failed</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable
            onPress={generate}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Back to Edit</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!result) {
    return null;
  }

  const { doc } = result;

  const goHome = () => {
    void Haptics.selectionAsync();
    // Keep the persisted export counter updated for future analytics, but no
    // longer use it to gate whether an ad shows — the ad now fires on every
    // back-to-home navigation.
    void incrementExportCount().catch(() => undefined);
    handleBack();
  };

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.topBar}>
        <Pressable
          hitSlop={8}
          onPress={goHome}
          style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
          accessibilityLabel="Back to home"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.centerWrap}>
        <View style={styles.successCard}>
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
            <Text style={styles.heading}>PDF Ready</Text>
          </View>

        {doc.thumbnailUri ? (
          <Image
            source={{ uri: doc.thumbnailUri }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbFallback]}>
            <Ionicons
              name="document-text"
              size={40}
              color={colors.textSecondary}
            />
          </View>
        )}

        <Text style={styles.title} numberOfLines={1}>
          {doc.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.meta}>
            {(doc.fileSizeBytes / 1024).toFixed(0)} KB
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={downloadPdf}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.downloadBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Ionicons name="download-outline" size={18} color={colors.primary} />
            <Text style={styles.downloadBtnText}>Download</Text>
          </Pressable>

          <Pressable
            onPress={sharePdf}
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.actionBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Ionicons name="share-outline" size={18} color={colors.white} />
            <Text style={styles.primaryBtnText}>Share</Text>
          </Pressable>
        </View>

        <Text style={styles.helper}>
          {Platform.OS === 'android'
            ? 'Download saves the PDF to Downloads. Share opens the native share sheet.'
            : 'Share opens the native share sheet — use “Save to Files” to download.'}
        </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  generatingWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    marginBottom: spacing.lg,
  },
  heading: {
    ...typography.screenTitle,
    color: colors.textPrimary,
    fontSize: 20,
  },
  thumbnail: {
    width: 120,
    height: 150,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLighter,
    marginBottom: spacing.lg,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 6,
    maxWidth: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  meta: {
    ...typography.secondary,
    color: colors.textSecondary,
  },
  metaDot: {
    color: colors.secondary,
    marginHorizontal: 6,
  },
  actionRow: {
    flexDirection: 'row',
    columnGap: 10,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    marginBottom: 0,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: colors.surfaceLighter,
    borderRadius: 999,
    paddingVertical: 14,
  },
  downloadBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surfaceLighter,
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  helper: {
    ...typography.badge,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    fontSize: 18,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});