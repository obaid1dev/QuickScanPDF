import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Shared primary/secondary buttons: filled accent with white text, and an
 * outlined variant with accent text. Press feedback scales to 98% and darkens
 * the fill slightly over 100ms. Disabled primary buttons use the muted
 * surface color with no elevation.
 */

const BUTTON_HEIGHT = 52;
const PRESS_MS = 100;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    primaryBase: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: spacing.xs,
      height: BUTTON_HEIGHT,
      borderRadius: radii.button,
    },
    primaryDisabled: {
      backgroundColor: colors.surfaceLighter,
    },
    primaryLabel: {
      ...typography.cardTitle,
      fontSize: 15,
      color: colors.onPrimary,
    },
    primaryLabelDisabled: {
      color: colors.textSecondary,
    },
    secondaryBase: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: spacing.xs,
      height: BUTTON_HEIGHT,
      borderRadius: radii.button,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryLabel: {
      ...typography.cardTitle,
      fontSize: 15,
      color: colors.accentText,
    },
  });

export interface DesignButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Extra layout styles from the caller (widths, margins). */
  style?: StyleProp<ViewStyle>;
}

/** Shared 100ms press animation: shared value 0 -> 1 while pressed. */
function usePressFeedback(enabled: boolean) {
  const amount = useSharedValue(0);
  const pressIn = () => {
    if (!enabled) {
      return;
    }
    amount.value = withTiming(1, {
      duration: PRESS_MS,
      easing: Easing.out(Easing.quad),
    });
  };
  const pressOut = () => {
    amount.value = withTiming(0, {
      duration: PRESS_MS,
      easing: Easing.out(Easing.quad),
    });
  };
  return { amount, pressIn, pressOut };
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
  style,
}: DesignButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { amount, pressIn, pressOut } = usePressFeedback(!disabled);

  // Works only with the animation: press scales to 0.98 and the fill
  // darkens from `primary` to `primaryPressed`.
  const pressedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.02 * amount.value }],
    backgroundColor:
      interpolateColor(amount.value, [0, 1], [
        colors.primary,
        colors.primaryPressed,
      ]) as string,
  }));

  if (disabled) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={[styles.primaryBase, styles.primaryDisabled, style]}
      >
        {icon ? (
          <Ionicons name={icon} size={20} color={colors.textSecondary} />
        ) : null}
        <Text style={[styles.primaryLabel, styles.primaryLabelDisabled]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.primaryBase, pressedStyle, style]}
    >
      {icon ? (
        <Ionicons name={icon} size={20} color={colors.onPrimary} />
      ) : null}
      <Text style={styles.primaryLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  icon,
  style,
}: DesignButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { amount, pressIn, pressOut } = usePressFeedback(!disabled);

  const pressedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.02 * amount.value }],
  }));

  if (disabled) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={[styles.secondaryBase, style]}
      >
        {icon ? (
          <Ionicons name={icon} size={20} color={colors.textSecondary} />
        ) : null}
        <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.secondaryBase, pressedStyle, style]}
    >
      {icon ? (
        <Ionicons name={icon} size={20} color={colors.accentText} />
      ) : null}
      <Text style={styles.secondaryLabel}>{label}</Text>
    </AnimatedPressable>
  );
}
