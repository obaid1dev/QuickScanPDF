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

/** Diameter of the docked camera button (72dp, up from 60dp). */
export const CAMERA_BUTTON_SIZE = 72;

/** How far the camera button rises above the bar's top edge. */
export const CAMERA_BUTTON_RISE = 22;

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
      borderWidth: 1,
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
    // Camera button, docked in the exact center of the bar and rising above
    // its top edge. Centered with left:'50%' + marginLeft:-SIZE/2, exact for
    // any bar width. The 5dp ring in the screen background color cuts the
    // button out of the bar so it reads as docked, not floating.
    cameraBtn: {
      position: 'absolute',
      width: CAMERA_BUTTON_SIZE,
      height: CAMERA_BUTTON_SIZE,
      borderRadius: CAMERA_BUTTON_SIZE / 2,
      marginLeft: -CAMERA_BUTTON_SIZE / 2,
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
    cameraContent: {
      alignItems: 'center',
    },
    cameraLabel: {
      ...typography.badge,
      fontSize: 12,
      fontWeight: '600',
      color: colors.onPrimary,
      marginTop: 1,
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
 * with its bottom 8dp above the safe-area gesture zone. Home sits in the left
 * column and Tools in the right; the round 72dp accent camera button docks
 * dead-center and rises 22dp above the bar's top edge with a ring cut-out and
 * a "Scan" label under the icon. The button starts a new scan exactly like
 * the old floating FAB did.
 */
export default function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors, resolved } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const insetsFallback = useSafeAreaInsets();
  const safeInset = Math.max(insets?.bottom ?? insetsFallback.bottom, 0);
  const { isActive, clearSession } = useScanSession();
  const [wrapWidth, setWrapWidth] = useState(0);
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
   * Measured, not guessed (release brief): with left:'50%' the button's own
   * layout x is half the wrapper minus half the button, so verify both
   * numbers agree. The wrap spans the full screen width. Runs in dev builds
   * only; a real mismatch means a layout bug upstream.
   */
  const measureCameraCenter = (bx: number, bw: number) => {
    if (!__DEV__ || wrapWidth === 0) {
      return;
    }
    const measured = bx + CAMERA_BUTTON_SIZE / 2;
    const expected = wrapWidth / 2;
    if (Math.abs(measured - expected) > 1) {
      console.log(
        `[QuickScan] TabBar: camera button off-center - x=${measured.toFixed(1)} expected=${expected.toFixed(1)}`,
      );
    }
  };

  return (
    <View
      style={[styles.wrap, { paddingBottom: safeInset + BAR_BOTTOM_GAP }]}
      onLayout={(e) => setWrapWidth(e.nativeEvent.layout.width)}
    >
      <View
        style={[
          styles.bar,
          resolved === 'light' && { boxShadow: cardShadow.light },
        ]}
      >
        <View style={styles.row}>
          {/* Left column: Home */}
          <View style={styles.column}>{renderTab(LEFT_TAB)}</View>
          {/* Center column: reserved for the docked camera button */}
          <View style={styles.column} />
          {/* Right column: Tools */}
          <View style={styles.column}>{renderTab(RIGHT_TAB)}</View>
        </View>
      </View>
      <AnimatedPressable
        onPress={startNewScan}
        onLayout={(e) => measureCameraCenter(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
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
          {
            left: '50%',
            bottom:
              safeInset +
              BAR_BOTTOM_GAP +
              BAR_HEIGHT -
              CAMERA_BUTTON_SIZE +
              CAMERA_BUTTON_RISE,
          },
          pressed && { opacity: 0.95 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Scan new document"
      >
        <View style={styles.cameraContent}>
          <Ionicons name="camera" size={30} color={colors.onPrimary} />
          <Text style={styles.cameraLabel}>Scan</Text>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
