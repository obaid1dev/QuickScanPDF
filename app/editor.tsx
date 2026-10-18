import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { useIsFocused, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import PageThumbnailStrip from '@/components/PageThumbnailStrip';
import CropModal from '@/components/CropModal';
import type { CropRect } from '@/components/CropModal';
import OcrFlowView from '@/components/OcrFlowView';
import { useScanSession } from '@/hooks/useScanSession';
import { useOcrFlow } from '@/hooks/useOcrFlow';
import { applyRotation, cropImage } from '@/lib/imageProcessing';
import { colors, spacing, typography } from '@/constants/theme';

export default function EditorScreen() {
  const router = useRouter();
  const {
    pages,
    currentPageId,
    activePage,
    isActive,
    setCurrentPage,
    updatePage,
    removePage,
    clearSession,
  } = useScanSession();

  const [box, setBox] = useState({ width: 0, height: 0 });
  const [cropVisible, setCropVisible] = useState(false);
  const seqRef = useRef(0);

  // Preloads the rewarded ad used to grant extra text extractions.
  const ocr = useOcrFlow();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const resetZoom = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  };

  // Jump back home if the session runs dry (last page deleted). Only redirect
  // while this editor is the focused screen: the share screen stays stacked on
  // top when a PDF finishes generating, and IT calls clearSession() — if we
  // redirected here, we'd yank the user home before the download/share screen
  // even appears.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isActive && isFocused) {
      clearSession();
      router.replace('/');
    }
  }, [isActive, isFocused, clearSession, router]);

  const rotate = async () => {
    if (!activePage) {
      return;
    }
    void Haptics.selectionAsync();
    const seq = ++seqRef.current;
    const { id, originalUri, rotation } = activePage;
    const nextRotation = ((rotation + 90) % 360) as 0 | 90 | 180 | 270;
    try {
      const rotated = await applyRotation(originalUri, nextRotation);
      if (seq !== seqRef.current) {
        return;
      }
      updatePage(id, { rotation: nextRotation, processedUri: rotated });
      resetZoom();
    } catch {
      if (seq === seqRef.current) {
        Alert.alert('Rotate failed', 'Could not rotate this page.');
      }
    }
  };

  const applyCrop = async (rect: CropRect) => {
    setCropVisible(false);
    if (!activePage) {
      return;
    }
    const seq = ++seqRef.current;
    const { id } = activePage;
    const source = activePage.processedUri ?? activePage.originalUri;
    try {
      const cropped = await cropImage(source, rect);
      if (seq !== seqRef.current) {
        return;
      }
      updatePage(id, {
        originalUri: cropped,
        rotation: 0,
        processedUri: cropped,
      });
      resetZoom();
    } catch {
      if (seq === seqRef.current) {
        Alert.alert('Crop failed', 'Could not crop this page.');
      }
    }
  };

  const handleDeletePage = useCallback(
    (id: string) => {
      if (pages.length === 1) {
        Alert.alert(
          'Delete last page?',
          'A document needs at least 1 page. Deleting it will discard this scan session.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => removePage(id),
            },
          ],
        );
        return;
      }
      void Haptics.selectionAsync();
      removePage(id);
    },
    [pages.length, removePage],
  );

  const selectPage = useCallback(
    (id: string) => {
      setCurrentPage(id);
    },
    [setCurrentPage],
  );

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const zoomGesture = Gesture.Simultaneous(
    Gesture.Pinch()
      .onUpdate((e) => {
        scale.value = Math.min(5, Math.max(1, savedScale.value * e.scale));
      })
      .onEnd(() => {
        savedScale.value = scale.value;
      }),
    Gesture.Pan()
      .onUpdate((e) => {
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      })
      .onEnd(() => {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      }),
  );

  const imageStyle = useAnimatedStyle(() => {
    const s = scale.value;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: s },
      ],
    };
  });

  // The current page's rendered image (rotation/crop already baked in). Falls
  // back to the raw original until the first render lands.
  const previewUri = activePage?.processedUri ?? activePage?.originalUri ?? null;
  const cropSource = activePage?.processedUri ?? activePage?.originalUri ?? '';

  // 1-based position of the page being edited, used for the OCR sheet title.
  const activeIndex = activePage
    ? pages.findIndex((p) => p.id === activePage.id)
    : -1;

  const extractText = useCallback(() => {
    if (!activePage) {
      return;
    }
    void Haptics.selectionAsync();
    const label = activeIndex >= 0 ? `Page ${activeIndex + 1} text` : 'Page text';
    ocr.requestOcr([activePage.processedUri ?? activePage.originalUri], label);
  }, [activePage, activeIndex, ocr]);

  return (
    <View style={styles.root}>
      <PageThumbnailStrip
        pages={pages}
        currentPageId={currentPageId}
        onSelectPage={selectPage}
        onDeletePage={handleDeletePage}
      />

      <View style={styles.previewArea} onLayout={onPreviewLayout}>
        <GestureDetector gesture={zoomGesture}>
          <Animated.View style={[styles.zoomHost, imageStyle]}>
            {box.width > 0 ? (
              <View
                style={{
                  width: box.width,
                  height: box.height,
                  backgroundColor: colors.background,
                }}
              >
                {previewUri ? (
                  <Image
                    source={{ uri: previewUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    transition={100}
                  />
                ) : (
                  <ActivityIndicator color={colors.primary} />
                )}
              </View>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.toolRow}>
          <Pressable
            onPress={rotate}
            accessibilityLabel="Rotate 90 degrees"
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
          >
            <Ionicons name="refresh" size={22} color={colors.textPrimary} />
            <Text style={styles.toolLabel}>Rotate</Text>
          </Pressable>

          <Pressable
            onPress={() => setCropVisible(true)}
            accessibilityLabel="Crop page"
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
          >
            <Ionicons name="crop-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.toolLabel}>Crop</Text>
          </Pressable>

          <Pressable
            onPress={extractText}
            disabled={!activePage}
            accessibilityLabel="Extract text"
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
          >
            <Ionicons
              name="text-outline"
              size={22}
              color={colors.textPrimary}
            />
            <Text style={styles.toolLabel} numberOfLines={2}>
              Extract text
            </Text>
          </Pressable>
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            onPress={() => router.push('/camera')}
            style={({ pressed }) => [
              styles.ctaSecondary,
              pressed && styles.btnPressed,
            ]}
          >
            <Ionicons name="camera-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.ctaSecondaryText}>Retake / Add</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/share')}
            style={({ pressed }) => [
              styles.ctaPrimary,
              pressed && styles.btnPressed,
            ]}
          >
            <Ionicons name="document-text" size={18} color={colors.white} />
            <Text style={styles.ctaPrimaryText}>Convert to PDF</Text>
          </Pressable>
        </View>
      </View>

      <OcrFlowView flow={ocr} />

      <CropModal
        visible={cropVisible}
        sourceUri={cropSource}
        onCancel={() => setCropVisible(false)}
        onApply={applyCrop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  previewArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  zoomHost: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.secondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    // Extra bottom clearance so the toolbar stays clear of the gesture-navigation
    // area now that the Android navigation bar is hidden (edge-to-edge).
    paddingBottom: spacing.xl,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  toolBtn: {
    flex: 1,
    alignItems: 'center',
    rowGap: 4,
  },
  toolBtnPressed: {
    opacity: 0.6,
  },
  toolLabel: {
    ...typography.badge,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ctaSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    backgroundColor: colors.surfaceLighter,
    borderRadius: 999,
    paddingVertical: 14,
  },
  ctaSecondaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  ctaPrimary: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
  },
  ctaPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
