import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScanSession } from '@/hooks/useScanSession';
import { normalizeToJpeg, precomputeVariants } from '@/lib/imageProcessing';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function CameraScreen() {
  const router = useRouter();
  const { pages, isActive, addPage, updatePage, clearSession } = useScanSession();
  const [scanning, setScanning] = useState(false);

  const goBackWithConfirm = useCallback(() => {
    if (isActive) {
      Alert.alert(
        'Discard scan session?',
        `${pages.length} captured page${pages.length === 1 ? '' : 's'} will be discarded.`,
        [
          { text: 'Keep Scanning', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              clearSession();
              router.back();
            },
          },
        ],
      );
    } else {
      router.back();
    }
  }, [isActive, pages.length, clearSession, router]);

  const finishCapture = useCallback(
    (uris: string[], hadPagesBefore: boolean) => {
      for (const uri of uris) {
        // Pre-render the B&W/Magic variants in the background so the editor's
        // filter switches are instant. The base at capture time is the original
        // at rotation 0, so variants are keyed by the raw URI.
        const id = addPage(uri);
        precomputeVariants(uri, (filter, variantUri) =>
          updatePage(id, (prev) => ({
            variants: {
              ...(prev.variants ?? {}),
              [uri]: { ...(prev.variants?.[uri] ?? {}), [filter]: variantUri },
            },
          })),
        );
      }
      if (hadPagesBefore) {
        router.back();
      } else {
        router.push('/editor');
      }
    },
    [addPage, updatePage, router],
  );

  const scan = async () => {
    if (scanning) {
      return;
    }
    setScanning(true);
    const hadPages = isActive;
    try {
      // The scanner is a native TurboModule (Google ML Kit on Android,
      // VisionKit on iOS). It must be loaded lazily: a top-level import runs
      // TurboModuleRegistry.getEnforcing(...) at module evaluation time, which
      // throws in Expo Go (native module not present) and would crash the whole
      // app on startup.
      const scanner = await import('react-native-document-scanner-plugin');
      const result = await scanner.default.scanDocument({
        croppedImageQuality: 90,
        maxNumDocuments: 10,
        responseType: scanner.ResponseType.ImageFilePath,
      });
      const uris = result.scannedImages ?? [];
      if (result.status === scanner.ScanDocumentResponseStatus.Success && uris.length > 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        finishCapture(uris, hadPages);
      }
    } catch {
      Alert.alert(
        'Scanner unavailable',
        'Document scanning uses a native scanner that is not included in Expo Go. Build the app as a dev build or production APK to scan documents — importing photos from the gallery still works.',
        [{ text: 'OK' }],
      );
    } finally {
      setScanning(false);
    }
  };

  const openGallery = async () => {
    // No runtime permission request here on purpose: the Android system Photo
    // Picker (Android 13+ Photo Picker, backported by expo-image-picker) runs
    // out-of-process and returns only what the user selects, so it needs no
    // broad media permission. Declaring/requesting READ_MEDIA_IMAGES is a Play
    // policy violation ("Photo and Video Permissions") for this use case.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const hadPages = isActive;
      const normalizedUris = await Promise.all(
        result.assets.map((a) => normalizeToJpeg(a.uri)),
      );
      finishCapture(normalizedUris, hadPages);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable
          hitSlop={8}
          onPress={goBackWithConfirm}
          style={styles.iconBtn}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </Pressable>
      </SafeAreaView>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="scan" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Scan a document</Text>
        <Text style={styles.subtitle}>
          The camera finds the edges of your document, crops and straightens it
          automatically. Hold the phone still over each page to capture it,
          then review everything in the editor.
        </Text>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.bottomArea}>
        {isActive ? (
          <Pressable
            onPress={() => router.push('/editor')}
            style={({ pressed }) => [
              styles.sessionCard,
              pressed && styles.sessionCardPressed,
            ]}
            accessibilityLabel="Review scan in editor"
          >
            <View style={styles.sessionIcon}>
              <Ionicons
                name="document-text-outline"
                size={22}
                color={colors.white}
              />
              <Text style={styles.sessionCount}>{pages.length}</Text>
            </View>
            <View style={styles.sessionTextWrap}>
              <Text style={styles.sessionTitle}>
                {pages.length} page{pages.length === 1 ? '' : 's'} in this scan
              </Text>
              <Text style={styles.sessionSub}>Review &amp; continue editing</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}

        <Pressable
          onPress={scan}
          disabled={scanning}
          style={({ pressed }) => [
            styles.scanBtn,
            (pressed || scanning) && styles.scanBtnPressed,
          ]}
          accessibilityLabel="Start scanning"
        >
          {scanning ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="camera" size={22} color={colors.white} />
              <Text style={styles.scanBtnText}>Start Scanning</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={openGallery}
          style={({ pressed }) => [
            styles.galleryBtn,
            pressed && styles.galleryBtnPressed,
          ]}
          accessibilityLabel="Import from gallery"
        >
          <Ionicons name="images-outline" size={20} color={colors.textPrimary} />
          <Text style={styles.galleryBtnText}>Import from Gallery</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    rowGap: spacing.md,
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 340,
  },
  bottomArea: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    rowGap: spacing.md,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    columnGap: spacing.md,
  },
  sessionCardPressed: {
    opacity: 0.85,
  },
  sessionIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    backgroundColor: colors.surfaceLighter,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  sessionCount: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  sessionTextWrap: {
    flex: 1,
    rowGap: 2,
  },
  sessionTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  sessionSub: {
    ...typography.badge,
    color: colors.textSecondary,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 16,
  },
  scanBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  scanBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.round,
    paddingVertical: 14,
  },
  galleryBtnPressed: {
    opacity: 0.85,
  },
  galleryBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});