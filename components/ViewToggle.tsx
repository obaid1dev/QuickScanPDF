import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

export type HomeView = 'files' | 'folders';

interface ViewToggleProps {
  view: HomeView;
  onChange: (next: HomeView) => void;
}

const OPTIONS: Array<{ value: HomeView; label: string }> = [
  { value: 'files', label: 'All files' },
  { value: 'folders', label: 'Folders' },
];

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      columnGap: spacing.sm,
    },
    option: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    optionPressed: {
      transform: [{ scale: 0.97 }],
    },
    label: {
      ...typography.cardTitle,
      color: colors.textSecondary,
      fontSize: 14,
    },
    labelActive: {
      color: colors.onPrimary,
    },
  });

/**
 * The Home screen's two-view switch ("All files" / "Folders"). The selected
 * option is a filled accent button with white text; the unselected one is a
 * plain surface with a border and muted text.
 */
export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
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
              active && styles.optionActive,
              pressed && styles.optionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Show ${option.label}`}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
