import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { SORT_OPTIONS, type SortOption } from '@/lib/sorting';

interface SortBarProps {
  value: SortOption;
  onChange: (next: SortOption) => void;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      columnGap: spacing.xs,
    },
    option: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 7,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.accentPill,
    },
    optionPressed: {
      transform: [{ scale: 0.96 }],
    },
    label: {
      ...typography.badge,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    labelActive: {
      color: colors.primary,
    },
  });

/**
 * Compact 5-way segmented sort control (Newest / Oldest / A–Z / Size /
 * Recent). Sized to fit a 360dp-wide phone in one row.
 */
export default function SortBar({ value, onChange }: SortBarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {SORT_OPTIONS.map((option) => {
        const active = option.value === value;
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
            accessibilityLabel={`Sort by ${option.label}`}
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
