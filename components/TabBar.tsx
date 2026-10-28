import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { cardShadow, radii, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useScanSession } from '@/hooks/useScanSession';

/**
 * Floating bar metrics. The bar is a rounded container inset 16dp from the
 * screen edges; its bottom sits above the Android gesture area (safe-area
 * bottom inset + 8dp). Screens that float content above the bar (the ad slot)
 * offset from BAR_HEIGHT + BAR_BOTTOM_GAP + the bottom inset.
 */
export const BAR_HEIGHT = 76;
export const BAR_BOTTOM_GAP = 8;
export const BAR_EDGE_INSET = 16;
/** The bar's hairline outline; included in the camera docking math. */
const BAR_BORDER_WIDTH = 1;

/** Diameter of the docked camera button (72dp). */
export const CAMERA_BUTTON_SIZE = 72;

/** How far the camera button's top rises above the bar's top edge. */
export const CAMERA_BUTTON_RISE = 22;

/**
 * Camera docking, measured from the bar's inner bottom edge (Fix 1: the
 * button is a child of the bar container, so its position derives from the
 * bar itself). Yoga sizes are border-box, so the bar's outer height is 76
 * and its inner (padding) box is 74; `bottom: B` anchors the button's lower
 * edge to the padding-box bottom, 1dp above the outer bottom edge. From the
 * bar's outer top edge the button's top then sits at `1 + (74 - B - 72) =
 * 73 - B`; choosing B = 76 - 1 - 72 + 22 = 25 puts the top exactly 22dp
 * above the bar's outer top edge.
 */
const CAMERA_BOTTOM_IN_BAR =
  BAR_HEIGHT - BAR_BORDER_WIDTH - CAMERA_BUTTON_SIZE + CAMERA_BUTTON_RISE;

/**
 * "Scan" label position, directly under the camera button's lower edge and
 * above the bar's bottom edge (same inner-bottom frame): label bottom =
 * camera lower edge, minus a 2dp gap and one label line (~16dp).
 */
const SCAN_LABEL_BOTTOM_IN_BAR = CAMERA_BOTTOM_IN_BAR - 16 - 2;

type IconName = keyof typeof Ionicons.glyphMap;

interface TabDef {
  name: string;
  label: string;
  active: IconName;
  inactive: IconName;
}

/** Home on the left, Tools on the right - Settings opens from the header gear. */
const LEFT_TAB: TabDef = {
  name: 'index',
  label: 'Home',
  active: 'home',
  inactive: 'home-outline',
};
const RIGHT_TAB: TabDef = {
  name: 'tools',
  label: 'Tools',
  active: 'construct',
  inactive: 'construct-outline',
};

const CAMERA_PRESS_MS = 100;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {},
    bar: {
      height: BAR_HEIGHT,
      marginHorizontal: BAR_EDGE_INSET,
      borderRadius: 28,
      borderWidth: BAR_BORDER_WIDTH,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'visible',
    },
    row: {
      flex: 1,
      flexDirection: 'row',
    },
    column: {
      flex: 1,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 12,
      justifyContent: 'flex-start',
    },
    itemPressed: {
      transform: [{ scale: 0.94 }],
      opacity: 0.85,
    },
    iconWrap: {
      width: 56,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    pill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: radii.round,
      backgroundColor: colors.accentPill,
    },
    iconHost: {
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...typography.badge,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 3,
    },
    labelActive: {
      color: colors.primary,
    },
    // Camera button: a child of the bar container so it stays docked no
    // matter how the navigator positions the bar. Centered with left:'50%'
    // + marginLeft -SIZE/2 (exact for any bar width). The 5dp ring in the
    // screen background color cuts it out of the bar.
    cameraBtn: {
      position: 'absolute',
      width: CAMERA_BUTTON_SIZE,
      height: CAMERA_BUTTON_SIZE,
      borderRadius: CAMERA_BUTTON_SIZE / 2,
      marginLeft: -CAMERA_BUTTON_SIZE / 2,
      bottom: CAMERA_BOTTOM_IN_BAR,
      backgroundColor: colors.primary,
      borderWidth: 5,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    // "Scan" label: inside the bar, centered, under the button's lower edge.
    // Accent on `surface` - measured 5.2:1 (light) and 8.2:1 (dark).
    scanLabelWrap: {
      position: 'absolute',
      bottom: SCAN_LABEL_BOTTOM_IN_BAR,
      left: 0,
      right: 0,
      alignItems: 'center',
      pointerEvents: 'none',
    },
    scanLabel: {
      ...typography.badge,
      fontSize: 12,
      fontWeight: '600',
      color: colors.accentText,
    },
  });

function TabItem({
  def,
  isActive,
  onSelect,
}: {
  def: TabDef;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const active = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    active.value = withSpring(isActive ? 1 : 0, {
      mass: 0.55,
      stiffness: 320,
      damping: 20,
    });
  }, [isActive, active]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: 0.78 + 0.22 * active.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.08 * active.value }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={def.label}
      accessibilityState={{ selected: isActive }}
      onPress={onSelect}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={styles.iconWrap}>
        <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
        <Animated.View style={[styles.iconHost, iconStyle]}>
          <Ionicons
            name={isActive ? def.active : def.inactive}
            size={24}
            color={isActive ? colors.primary : colors.textSecondary}
          />
        </Animated.View>
      </View>
      <Text style={[styles.label, isActive && styles.labelActive]}>{def.label}</Text>
    </Pressable>
  );
}

/**
 * Custom floating tab bar for Expo Router's bottom tabs: a rounded container
 * (28dp radius, 1px border, soft shadow) inset 16dp from the screen edges,
 * with its bottom 8dp above the safe-area gesture zone. Home sits left and
 * Tools right; the 72dp accent camera button is docked as a child of the bar
 * container, dead-center, with its top 22dp above the bar's top edge and a
 * ring cut-out; the "Scan" label sits under it inside the bar. The button
 * starts a new scan exactly like the old floating FAB did.
 */
export default function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors, resolved } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const insetsFallback = useSafeAreaInsets();
  const safeInset = Math.max(insets?.bottom ?? insetsFallback.bottom, 0);
  const { isActive, clearSession } = useScanSession();
  const [barWidth, setBarWidth] = useState(0);
  const cameraPress = useSharedValue(0);

  const cameraPressedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.04 * cameraPress.value }],
  }));

  const startNewScan = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isActive) {
      clearSession();
    }
    router.push('/camera');
  };

  const renderTab = (def: TabDef) => {
    const index = state.routes.findIndex((r) => r.name === def.name);
    if (index < 0) {
      return null;
    }
    return (
      <TabItem
        key={def.name}
        def={def}
        isActive={state.index === index}
        onSelect={() => {
          if (state.index === index) {
            return;
          }
          void Haptics.selectionAsync();
          navigation.navigate(def.name);
        }}
      />
    );
  };

  /**
   * Measured, not guessed (release brief). In dev builds only:
   * - horizontal: the camera's center x must equal half the bar's width.
   * - vertical: the camera's center y must sit CAMERA_BUTTON_RISE above the
   *   bar's top edge (center y 14dp below the bar's top edge in the bar's
   *   own coords) within 2dp.
   * A mismatch names the component and its measured values.
   */
  const measureCameraLayout = (x: number, y: number, w: number) => {
    if (!__DEV__ || barWidth === 0) {
      return;
    }
    const centerX = x + CAMERA_BUTTON_SIZE / 2;
    const expectedCenterX = barWidth / 2;
    // Center measured from the bar's border-box top edge (the frame onLayout
    // reports): the top sits `rise` above it, so the center is half a button
    // minus the rise below it = 36 - 22 = 14.
    const centerYFromTop = y + CAMERA_BUTTON_SIZE / 2;
    const expectedCenterYFromTop = CAMERA_BUTTON_SIZE / 2 - CAMERA_BUTTON_RISE;
    if (
      Math.abs(centerX - expectedCenterX) > 1 ||
      Math.abs(centerYFromTop - expectedCenterYFromTop) > 2
    ) {
      console.log(
        `[QuickScan] TabBar: camera button misaligned - centerX=${centerX.toFixed(1)} (expected ${expectedCenterX.toFixed(1)}), centerYFromTop=${centerYFromTop.toFixed(1)} (expected ${expectedCenterYFromTop.toFixed(1)})`,
      );
    }
  };

  return (
    <View
      style={[styles.wrap, { paddingBottom: safeInset + BAR_BOTTOM_GAP }]}
    >
      <View
        style={[
          styles.bar,
          resolved === 'light' && { boxShadow: cardShadow.light },
        ]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.row}>
          {/* Left column: Home */}
          <View style={styles.column}>{renderTab(LEFT_TAB)}</View>
          {/* Center column: reserved for the docked camera button */}
          <View style={styles.column} />
          {/* Right column: Tools */}
          <View style={styles.column}>{renderTab(RIGHT_TAB)}</View>
        </View>

        {/* "Scan" label: a child of the bar, under the camera button, so it
            can never drift outside the bar's bottom edge. */}
        <View style={styles.scanLabelWrap} pointerEvents="none">
          <Text style={styles.scanLabel}>Scan</Text>
        </View>

        {/* Camera button: a child of the bar container (Fix 1). */}
        <AnimatedPressable
          onPress={startNewScan}
          onLayout={(e) =>
            measureCameraLayout(
              e.nativeEvent.layout.x,
              e.nativeEvent.layout.y,
              e.nativeEvent.layout.width,
            )
          }
          onPressIn={() => {
            cameraPress.value = withTiming(1, {
              duration: CAMERA_PRESS_MS,
              easing: Easing.out(Easing.quad),
            });
          }}
          onPressOut={() => {
            cameraPress.value = withTiming(0, {
              duration: CAMERA_PRESS_MS,
              easing: Easing.out(Easing.quad),
            });
          }}
          style={({ pressed }: { pressed: boolean }) => [
            styles.cameraBtn,
            cameraPressedStyle,
            pressed && { opacity: 0.95 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scan new document"
        >
          <Ionicons name="camera" size={30} color={colors.onPrimary} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
