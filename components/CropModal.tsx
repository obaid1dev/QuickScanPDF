import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { colors, spacing, typography } from '@/constants/theme';
import { getImagePixelSize } from '@/lib/imageProcessing';

const HANDLE_HIT = 44;
const HALF = HANDLE_HIT / 2;
const MIN_CROP_PX = 48;

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

interface CropModalProps {
  visible: boolean;
  sourceUri: string;
  onCancel: () => void;
  onApply: (rect: CropRect) => void;
}

/**
 * Full-screen crop editor. The source image is fitted ("contain") into the
 * available area and a moveable/resizable crop rectangle is drawn on top.
 *
 * IMPORTANT: the image is letterboxed at (`disp.left`, `disp.top`), so every
 * overlay (box, masks, handles) is positioned in *container* coordinates as
 * `disp.left + nX * disp.width` / `disp.top + nY * disp.height`. Positioning
 * them against only the image size would mis-align the crop box onto the
 * letterbox when the image aspect doesn't match the screen.
 *
 * Handles run on the UI thread via reanimated shared values so the box tracks
 * touch input without jank. onApply reports the crop rectangle in *source
 * image pixel* coordinates.
 */
export default function CropModal({
  visible,
  sourceUri,
  onCancel,
  onApply,
}: CropModalProps) {
  const [container, setContainer] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const nX = useSharedValue(0.08);
  const nY = useSharedValue(0.08);
  const nW = useSharedValue(0.84);
  const nH = useSharedValue(0.84);

  useEffect(() => {
    if (visible) {
      nX.value = 0.08;
      nY.value = 0.08;
      nW.value = 0.84;
      nH.value = 0.84;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sourceUri]);

  useEffect(() => {
    let mounted = true;
    setContainer(null);
    setImageSize(null);
    if (visible && sourceUri) {
      void getImagePixelSize(sourceUri)?.then((size) => {
        if (mounted) {
          setImageSize(size);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [visible, sourceUri]);

  const disp = useMemo(() => {
    if (!container || !imageSize) {
      return null;
    }
    const scale = Math.min(
      container.width / imageSize.width,
      container.height / imageSize.height,
    );
    const width = imageSize.width * scale;
    const height = imageSize.height * scale;
    return {
      width,
      height,
      left: (container.width - width) / 2,
      top: (container.height - height) / 2,
    };
  }, [container, imageSize]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainer((prev) =>
      prev && prev.width === width && prev.height === height
        ? prev
        : { width, height },
    );
  };

  const boxStyle = useAnimatedStyle(() => {
    const dw = disp?.width ?? 0;
    const dh = disp?.height ?? 0;
    return {
      left: (disp?.left ?? 0) + nX.value * dw,
      top: (disp?.top ?? 0) + nY.value * dh,
      width: nW.value * dw,
      height: nH.value * dh,
    };
  });

  const maskTopStyle = useAnimatedStyle(() => {
    const dh = disp?.height ?? 0;
    return {
      left: 0,
      right: 0,
      top: 0,
      height: (disp?.top ?? 0) + nY.value * dh,
    };
  });
  const maskBottomStyle = useAnimatedStyle(() => {
    const dh = disp?.height ?? 0;
    const cH = container?.height ?? 0;
    return {
      left: 0,
      right: 0,
      top: (disp?.top ?? 0) + (nY.value + nH.value) * dh,
      height: cH - (disp?.top ?? 0) - (nY.value + nH.value) * dh,
    };
  });
  const maskLeftStyle = useAnimatedStyle(() => {
    const dw = disp?.width ?? 0;
    const dh = disp?.height ?? 0;
    return {
      left: 0,
      top: (disp?.top ?? 0) + nY.value * dh,
      height: nH.value * dh,
      width: (disp?.left ?? 0) + nX.value * dw,
    };
  });
  const maskRightStyle = useAnimatedStyle(() => {
    const dw = disp?.width ?? 0;
    const dh = disp?.height ?? 0;
    return {
      left: (disp?.left ?? 0) + (nX.value + nW.value) * dw,
      top: (disp?.top ?? 0) + nY.value * dh,
      height: nH.value * dh,
      width:
        (container?.width ?? 0) -
        ((disp?.left ?? 0) + (nX.value + nW.value) * dw),
    };
  });

  const offset = (disp?.left ?? 0);
  const offTop = (disp?.top ?? 0);
  const tlStyle = useAnimatedStyle(() => ({
    left: offset + nX.value * (disp?.width ?? 0) - HALF,
    top: offTop + nY.value * (disp?.height ?? 0) - HALF,
  }));
  const trStyle = useAnimatedStyle(() => ({
    left: offset + (nX.value + nW.value) * (disp?.width ?? 0) - HALF,
    top: offTop + nY.value * (disp?.height ?? 0) - HALF,
  }));
  const blStyle = useAnimatedStyle(() => ({
    left: offset + nX.value * (disp?.width ?? 0) - HALF,
    top: offTop + (nY.value + nH.value) * (disp?.height ?? 0) - HALF,
  }));
  const brStyle = useAnimatedStyle(() => ({
    left: offset + (nX.value + nW.value) * (disp?.width ?? 0) - HALF,
    top: offTop + (nY.value + nH.value) * (disp?.height ?? 0) - HALF,
  }));
  const tcStyle = useAnimatedStyle(() => ({
    left: offset + (nX.value + nW.value / 2) * (disp?.width ?? 0) - HALF,
    top: offTop + nY.value * (disp?.height ?? 0) - HALF,
  }));
  const bcStyle = useAnimatedStyle(() => ({
    left: offset + (nX.value + nW.value / 2) * (disp?.width ?? 0) - HALF,
    top: offTop + (nY.value + nH.value) * (disp?.height ?? 0) - HALF,
  }));
  const lcStyle = useAnimatedStyle(() => ({
    left: offset + nX.value * (disp?.width ?? 0) - HALF,
    top: offTop + (nY.value + nH.value / 2) * (disp?.height ?? 0) - HALF,
  }));
  const rcStyle = useAnimatedStyle(() => ({
    left: offset + (nX.value + nW.value) * (disp?.width ?? 0) - HALF,
    top: offTop + (nY.value + nH.value / 2) * (disp?.height ?? 0) - HALF,
  }));

  const gestures = useMemo(() => {
    if (!disp) {
      return null;
    }
    const dw = disp.width;
    const dh = disp.height;
    const minW = MIN_CROP_PX / dw;
    const minH = MIN_CROP_PX / dh;

    const topLeft = Gesture.Pan().onChange((e) => {
      const dx = e.changeX / dw;
      const dy = e.changeY / dh;
      nW.value = Math.min(Math.max(nW.value - dx, minW), 1 - nX.value);
      nX.value = Math.min(Math.max(nX.value + dx, 0), nX.value + nW.value - minW);
      nH.value = Math.min(Math.max(nH.value - dy, minH), 1 - nY.value);
      nY.value = Math.min(Math.max(nY.value + dy, 0), nY.value + nH.value - minH);
    });
    const topRight = Gesture.Pan().onChange((e) => {
      const dx = e.changeX / dw;
      const dy = e.changeY / dh;
      nW.value = Math.min(Math.max(nW.value + dx, minW), 1 - nX.value);
      nH.value = Math.min(Math.max(nH.value - dy, minH), 1 - nY.value);
      nY.value = Math.min(Math.max(nY.value + dy, 0), nY.value + nH.value - minH);
    });
    const bottomLeft = Gesture.Pan().onChange((e) => {
      const dx = e.changeX / dw;
      const dy = e.changeY / dh;
      nW.value = Math.min(Math.max(nW.value - dx, minW), 1 - nX.value);
      nX.value = Math.min(Math.max(nX.value + dx, 0), nX.value + nW.value - minW);
      nH.value = Math.min(Math.max(nH.value + dy, minH), 1 - nY.value);
    });
    const bottomRight = Gesture.Pan().onChange((e) => {
      const dx = e.changeX / dw;
      const dy = e.changeY / dh;
      nW.value = Math.min(Math.max(nW.value + dx, minW), 1 - nX.value);
      nH.value = Math.min(Math.max(nH.value + dy, minH), 1 - nY.value);
    });
    const top = Gesture.Pan().onChange((e) => {
      const dy = e.changeY / dh;
      nH.value = Math.min(Math.max(nH.value - dy, minH), 1 - nY.value);
      nY.value = Math.min(Math.max(nY.value + dy, 0), nY.value + nH.value - minH);
    });
    const right = Gesture.Pan().onChange((e) => {
      const dx = e.changeX / dw;
      nW.value = Math.min(Math.max(nW.value + dx, minW), 1 - nX.value);
    });
    const bottom = Gesture.Pan().onChange((e) => {
      const dy = e.changeY / dh;
      nH.value = Math.min(Math.max(nH.value + dy, minH), 1 - nY.value);
    });
    const left = Gesture.Pan().onChange((e) => {
      const dx = e.changeX / dw;
      nW.value = Math.min(Math.max(nW.value - dx, minW), 1 - nX.value);
      nX.value = Math.min(Math.max(nX.value + dx, 0), nX.value + nW.value - minW);
    });
    const move = Gesture.Pan().onChange((e) => {
      const dx = e.changeX / dw;
      const dy = e.changeY / dh;
      nX.value = Math.min(Math.max(nX.value + dx, 0), 1 - nW.value);
      nY.value = Math.min(Math.max(nY.value + dy, 0), 1 - nH.value);
    });

    return {
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
      top,
      right,
      bottom,
      left,
      move,
    };
  }, [disp, nX, nY, nW, nH]);

  const handleApply = () => {
    if (!disp || !imageSize) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ox = Math.min(Math.max(nX.value, 0), 1);
    const oy = Math.min(Math.max(nY.value, 0), 1);
    const w = Math.min(Math.max(nW.value, 0), 1 - ox);
    const h = Math.min(Math.max(nH.value, 0), 1 - oy);
    onApply({
      originX: Math.round(ox * imageSize.width),
      originY: Math.round(oy * imageSize.height),
      width: Math.round(w * imageSize.width),
      height: Math.round(h * imageSize.height),
    });
  };

  const ready = Boolean(disp && gestures);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.topBar}>
          <Pressable hitSlop={8} onPress={onCancel} style={styles.barBtn}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
            <Text style={styles.barLabel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Crop Page</Text>
          <Pressable hitSlop={8} onPress={handleApply} disabled={!ready} style={styles.barBtn}>
            <Text style={[styles.applyLabel, !ready && styles.applyDisabled]}>
              Apply
            </Text>
            <Ionicons
              name="checkmark"
              size={22}
              color={ready ? colors.primary : colors.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.area} onLayout={onLayout}>
          {!disp ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Image
                source={{ uri: sourceUri }}
                style={{
                  position: 'absolute',
                  width: disp.width,
                  height: disp.height,
                  left: disp.left,
                  top: disp.top,
                }}
                contentFit="fill"
                transition={150}
              />

              {/* Dim areas: container coordinates, always frame the crop box */}
              <Animated.View pointerEvents="none" style={[styles.mask, maskTopStyle]} />
              <Animated.View pointerEvents="none" style={[styles.mask, maskBottomStyle]} />
              <Animated.View pointerEvents="none" style={[styles.mask, maskLeftStyle]} />
              <Animated.View pointerEvents="none" style={[styles.mask, maskRightStyle]} />

              <Animated.View pointerEvents="none" style={[styles.boxBorder, boxStyle]} />

              <GestureDetector gesture={gestures!.move}>
                <Animated.View style={[styles.moveLayer, boxStyle]} />
              </GestureDetector>

              <GestureDetector gesture={gestures!.topLeft}>
                <Animated.View style={[styles.handle, tlStyle]}>
                  <View style={[styles.cornerKnob]} />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={gestures!.topRight}>
                <Animated.View style={[styles.handle, trStyle]}>
                  <View style={[styles.cornerKnob]} />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={gestures!.bottomLeft}>
                <Animated.View style={[styles.handle, blStyle]}>
                  <View style={[styles.cornerKnob]} />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={gestures!.bottomRight}>
                <Animated.View style={[styles.handle, brStyle]}>
                  <View style={[styles.cornerKnob]} />
                </Animated.View>
              </GestureDetector>

              <GestureDetector gesture={gestures!.top}>
                <Animated.View style={[styles.handle, tcStyle]}>
                  <View style={[styles.edgeKnob]} />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={gestures!.right}>
                <Animated.View style={[styles.handle, rcStyle]}>
                  <View style={[styles.edgeKnob]} />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={gestures!.bottom}>
                <Animated.View style={[styles.handle, bcStyle]}>
                  <View style={[styles.edgeKnob]} />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={gestures!.left}>
                <Animated.View style={[styles.handle, lcStyle]}>
                  <View style={[styles.edgeKnob]} />
                </Animated.View>
              </GestureDetector>
            </>
          )}
        </View>

        <Text style={styles.hint}>Drag corners to resize • drag inside to move</Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.secondary,
  },
  barBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 2,
    minWidth: 84,
  },
  barLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  applyLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  applyDisabled: {
    color: colors.textSecondary,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    fontSize: 16,
  },
  area: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#030303',
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  boxBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 2,
  },
  moveLayer: {
    position: 'absolute',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_HIT,
    height: HANDLE_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerKnob: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  edgeKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  hint: {
    ...typography.badge,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});