import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

export type HomeView = 'files' | 'folders';

interface ViewToggleProps {
  view: HomeView;
  onChange: (next: HomeView) => void;
}

const OPTIONS: Array<{ value: HomeView; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'files', label: 'All files', icon: 'grid-outline' },
  { value: 'folders', label: 'Folders', icon: 'folder-outline' },
];

/** Duration of the selected-pill slide between segments. */
const SLIDE_MS = 150;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.round,
      padding: 4,
    },
    // The filled pill that slides behind the selected segment.
    pillBase: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      borderRadius: radii.round,
      backgroundColor: colors.primary,
    },
    option: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: spacing.xs,
      zIndex: 1,
    },
    optionPressed: {
      transform: [{ scale: 0.97 }],
    },
    labelText: {
      ...typography.cardTitle,
      fontSize: 14,
    },
  });

/**
 * The Home screen's two-view switch ("All files" / "Folders"). One pill
 * container with a surface background and a 1px border; the selected segment
 * is a filled accent pill that slides between the two equal halves.
 */
export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [trackWidth, setTrackWidth] = useState(0);

  const segmentWidth = trackWidth > 0 ? (trackWidth - 8) / 2 : 0;

  const slide = useSharedValue(view === 'folders' ? 1 : 0);

  useEffect(() => {
    slide.value = withTiming(view === 'folders' ? 1 : 0, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [view, slide]);

  const pillStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: slide.value * segmentWidth }],
  }));

  // Label colors follow the sliding pill so white text tracks the fill.
  const filesLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      1 - slide.value,
      [0, 1],
      [colors.textSecondary, colors.onPrimary],
    ) as string,
  }));
  const foldersLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      slide.value,
      [0, 1],
      [colors.textSecondary, colors.onPrimary],
    ) as string,
  }));

  return (
    <View
      style={styles.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View style={[styles.pillBase, { left: 4 }, pillStyle]} />
      ) : null}
      {OPTIONS.map((option, index) => {
        const active = option.value === view;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (active) {
                return;
              }
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Show ${option.label}`}
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={option.icon}
              size={18}
              color={active ? colors.onPrimary : colors.textSecondary}
            />
            <Animated.Text
              style={[
                styles.labelText,
                index === 0 ? filesLabelStyle : foldersLabelStyle,
              ]}
            >
              {option.label}
            </Animated.Text>
          </Pressable>
        );
      })}
    </View>
  );
}
