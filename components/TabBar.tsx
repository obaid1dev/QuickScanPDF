import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
 * Height of the bar's content row. Screens that float things above the bar
 * (the ad slot, in-screen FABs) offset by this plus the bottom inset.
 */
export const TAB_BAR_ROW_HEIGHT = 62;

/** Diameter of the center camera button docked in the bar. */
export const CAMERA_BUTTON_SIZE = 60;

/** How far the camera button rises above the bar's top edge. */
export const CAMERA_BUTTON_RISE = 18;

type IconName = keyof typeof Ionicons.glyphMap;

interface TabDef {
  name: string;
  label: string;
  active: IconName;
  inactive: IconName;
}

/**
 * Option B per the release brief: the bar shows ONE tab on each side of the
 * centered camera button - Home on the left, Tools on the right. Settings
 * left the bar and is opened from the gear icon in the Home screen's header
 * (the screen and its route are unchanged).
 */
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      height: TAB_BAR_ROW_HEIGHT,
    },
    column: {
      flex: 1,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 6,
      justifyContent: 'flex-start',
    },
    itemPressed: {
      transform: [{ scale: 0.94 }],
      opacity: 0.85,
    },
    iconWrap: {
      width: 56,
      height: 32,
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
      marginTop: 2,
    },
    labelActive: {
      color: colors.primary,
    },
    // Camera button, docked in the exact center of the bar and rising above
    // its top edge. Centered with left:'50%' + marginLeft:-SIZE/2, which is
    // exact for any bar width.
    cameraBtn: {
      position: 'absolute',
      width: CAMERA_BUTTON_SIZE,
      height: CAMERA_BUTTON_SIZE,
      borderRadius: CAMERA_BUTTON_SIZE / 2,
      marginLeft: -CAMERA_BUTTON_SIZE / 2,
      backgroundColor: colors.primary,
      borderWidth: 4,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    cameraBtnPressed: {
      transform: [{ scale: 0.93 }],
      opacity: 0.94,
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
 * Custom tab bar for Expo Router's bottom tabs, built as three equal columns:
 * the left column holds Home, the center column is where the round accent
 * camera button docks (dead-center, rising above the bar's top edge), and the
 * right column holds Tools. The camera button starts a new scan exactly like
 * the old floating FAB did. Sits above the Android gesture area via the
 * bottom safe-area inset.
 */
export default function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors, resolved } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const insetsFallback = useSafeAreaInsets();
  const safeInset = Math.max(insets?.bottom ?? insetsFallback.bottom, 0);
  const { isActive, clearSession } = useScanSession();
  const [barWidth, setBarWidth] = useState(0);

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
   * layout x is barCenter - half the button, so verify both numbers agree.
   * Runs in dev builds only; a real mismatch means a layout bug upstream.
   */
  const measureCameraCenter = (bx: number, bw: number) => {
    if (!__DEV__ || barWidth === 0) {
      return;
    }
    const measured = bx + CAMERA_BUTTON_SIZE / 2;
    const expected = barWidth / 2;
    if (Math.abs(measured - expected) > 1) {
      console.log(
        `[QuickScan] TabBar: camera button off-center - x=${measured.toFixed(1)} expected=${expected.toFixed(1)}`,
      );
    }
  };

  return (
    <View
      style={[
        styles.bar,
        resolved === 'light' && { boxShadow: cardShadow.light },
        { paddingBottom: safeInset },
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
      <Pressable
        onPress={startNewScan}
        onLayout={(e) => measureCameraCenter(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
        style={({ pressed }) => [
          styles.cameraBtn,
          {
            left: '50%',
            bottom: safeInset + TAB_BAR_ROW_HEIGHT - CAMERA_BUTTON_SIZE + CAMERA_BUTTON_RISE,
          },
          pressed && styles.cameraBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Scan new document"
      >
        <Ionicons name="camera" size={26} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}
