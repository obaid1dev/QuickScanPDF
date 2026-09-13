import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import * as SkiaNamespace from '@shopify/react-native-skia';
import PageThumbnailStrip from '@/components/PageThumbnailStrip';
import FilterThumbnail from '@/components/FilterThumbnail';
import CropModal from '@/components/CropModal';
import type { CropRect } from '@/components/CropModal';
import { useScanSession } from '@/hooks/useScanSession';
import {
  applyColorFilter,
  applyRotation,
  cropImage,
  filterColorMatrix,
} from '@/lib/imageProcessing';
import { colors, spacing, typography } from '@/constants/theme';
import type { FilterType } from '@/types/document';

// The package ships intact runtime exports but a subset of its type
// declarations are minified; recover the missing pieces at runtime.
const SkiaRuntime = SkiaNamespace as unknown as {
  Group: React.ComponentType<{ children?: React.ReactNode }>;
  ColorMatrix: React.ComponentType<{ matrix: number[]; children?: React.ReactNode }>;
};

const { Group, ColorMatrix } = SkiaRuntime;

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'bw', label: 'B&W' },
  { value: 'magic_color', label: 'Magic' },
];

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

  const [baseUri, setBaseUri] = useState<string | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [cropVisible, setCropVisible] = useState(false);
  const seqRef = useRef(0);
  const activeRef = useRef(activePage);

  useEffect(() => {
    activeRef.current = activePage;
  }, [activePage]);

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

  // (Re)build the rotation-only base image whenever the active page rotates.
  useEffect(() => {
    if (!activePage) {
      return;
    }
    const id = activePage.id;
    let cancelled = false;
    resetZoom();
    setBaseUri(null);
    applyRotation(activePage.originalUri, activePage.rotation)
      .then((uri) => {
        if (!cancelled && id === activePage.id) {
          setBaseUri(uri);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage?.id, activePage?.rotation]);

  // The declarative Skia preview is driven by the *un-filtered* base image so
  // filter changes apply instantly without re-encoding a file.
  const previewImage = useImage(baseUri ?? activePage?.originalUri ?? '');

  const finalize = useCallback(
    async (id: string, sourceUri: string, filter: FilterType, seq: number) => {
      try {
        const processed =
          filter === 'original'
            ? sourceUri
            : await applyColorFilter(sourceUri, filter);
        if (seq === seqRef.current) {
          updatePage(id, { processedUri: processed });
        }
      } catch {
        if (seq === seqRef.current) {
          updatePage(id, { processedUri: sourceUri });
        }
      }
    },
    [updatePage],
  );

  const applyFilter = useCallback(
    async (filter: FilterType) => {
      if (!activePage || filter === activePage.filter) {
        return;
      }
      void Haptics.selectionAsync();
      const seq = ++seqRef.current;
      const { id, originalUri, rotation } = activePage;
      // The selection + preview update synchronously (the canvas applies the
      // color matrix declaratively); the disk copy is rebuilt in the background
      // for thumbnails and PDF assembly. The base is re-derived from the page's
      // rotation state rather than the in-flight `baseUri` so a filter tapped
      // during the rotate-base rebuild can never bake a stale (unrotated) copy.
      updatePage(id, { filter });
      try {
        const base = await applyRotation(originalUri, rotation);
        if (seq === seqRef.current) {
          await finalize(id, base, filter, seq);
        }
      } catch {
        if (seq === seqRef.current) {
          await finalize(id, originalUri, filter, seq).catch(() => undefined);
        }
      }
    },
    [activePage, updatePage, finalize],
  );

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
      setBaseUri(rotated);
      updatePage(id, { rotation: nextRotation, processedUri: rotated });
      resetZoom();
      await finalize(id, rotated, activeRef.current?.filter ?? activePage.filter, seq);
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
    const { id, filter } = activePage;
    const source = baseUri ?? activePage.originalUri;
    try {
      const cropped = await cropImage(source, rect);
      if (seq !== seqRef.current) {
        return;
      }
      setBaseUri(cropped);
      updatePage(id, {
        originalUri: cropped,
        rotation: 0,
        processedUri: cropped,
      });
      resetZoom();
      await finalize(id, cropped, activeRef.current?.filter ?? filter, seq);
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

  const filter =
    activePage && activePage.filter !== 'original' ? activePage.filter : null;
  const filterMatrix = filter ? filterColorMatrix(filter) : null;
  const previewUri = activePage?.processedUri ?? null;

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
                {/* Base layer: the last finalized render. Stays mounted while
                    the Skia image for `baseUri` decodes, so the preview never
                    blanks to black. */}
                {previewUri ? (
                  <Image
                    source={{ uri: previewUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                  />
                ) : (
                  <ActivityIndicator color={colors.primary} />
                )}

                {/* Filter/rotate layer: a single, opaque Skia canvas on top.
                    No keys or fade animations — swapping the ColorMatrix or the
                    source image updates in place, so switching filters is
                    instant with no black flash. */}
                {previewImage ? (
                  <View style={StyleSheet.absoluteFill}>
                    <Canvas
                      style={{
                        width: box.width,
                        height: box.height,
                        backgroundColor: colors.background,
                      }}
                    >
                      <Group>
                        {filterMatrix ? (
                          <ColorMatrix matrix={filterMatrix} />
                        ) : null}
                        <SkiaImage
                          image={previewImage}
                          x={0}
                          y={0}
                          width={box.width}
                          height={box.height}
                          fit="contain"
                        />
                      </Group>
                    </Canvas>
                  </View>
                ) : null}
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

          <View style={styles.filterRow}>
            {filterOptions.map((opt) => (
              <FilterThumbnail
                key={opt.value}
                sourceUri={baseUri ?? (activePage?.originalUri ?? '')}
                filter={opt.value}
                label={opt.label}
                selected={activePage?.filter === opt.value}
                onSelect={applyFilter}
              />
            ))}
          </View>
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

      <CropModal
        visible={cropVisible}
        sourceUri={baseUri ?? activePage?.originalUri ?? ''}
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
    paddingBottom: spacing.lg,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  toolBtn: {
    width: 46,
    alignItems: 'center',
    rowGap: 4,
  },
  toolBtnPressed: {
    opacity: 0.6,
  },
  toolLabel: {
    ...typography.badge,
    color: colors.textSecondary,
  },
  filterRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
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