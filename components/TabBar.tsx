import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { cardShadow, radii, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Height of the bar's content row. Screens that float things above the bar
 * (the dashboard banner, the FAB) offset by this plus the bottom inset.
 */
export const TAB_BAR_ROW_HEIGHT = 62;

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: Array<{
  name: string;
  label: string;
  active: IconName;
  inactive: IconName;
}> = [
  { name: 'index', label: 'Home', active: 'home', inactive: 'home-outline' },
  { name: 'tools', label: 'Tools', active: 'construct', inactive: 'construct-outline' },
  { name: 'settings', label: 'Settings', active: 'settings', inactive: 'settings-outline' },
];

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
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 2,
    },
    labelActive: {
      color: colors.primary,
    },
  });

function TabItem({
  label,
  activeIcon,
  inactiveIcon,
  isActive,
  onSelect,
}: {
  label: string;
  activeIcon: IconName;
  inactiveIcon: IconName;
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
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      onPress={onSelect}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={styles.iconWrap}>
        <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
        <Animated.View style={[styles.iconHost, iconStyle]}>
          <Ionicons
            name={isActive ? activeIcon : inactiveIcon}
            size={23}
            color={isActive ? colors.primary : colors.textSecondary}
          />
        </Animated.View>
      </View>
      <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Custom tab bar for Expo Router's bottom tabs: three equal slots, the
 * active tab marked with a soft accent pill, a filled icon and the accent
 * color, and a light selection haptic. Sits above the Android gesture area
 * via the bottom safe-area inset.
 */
export default function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors, resolved } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const safeInset = useSafeAreaInsets();
  const bottomInset = insets?.bottom ?? safeInset.bottom;

  return (
    <View
      style={[
        styles.bar,
        resolved === 'light' && { boxShadow: cardShadow.light },
        { paddingBottom: Math.max(bottomInset, 0) },
      ]}
    >
      <View style={styles.row}>
        {TABS.map((tab) => {
          const index = state.routes.findIndex((r) => r.name === tab.name);
          if (index < 0) {
            return null;
          }
          const isActive = state.index === index;
          return (
            <TabItem
              key={tab.name}
              label={tab.label}
              activeIcon={tab.active}
              inactiveIcon={tab.inactive}
              isActive={isActive}
              onSelect={() => {
                if (isActive) {
                  return;
                }
                void Haptics.selectionAsync();
                navigation.navigate(tab.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
