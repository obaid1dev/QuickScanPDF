import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface FABProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Accessibility label; defaults to the camera action ("Add scans" FAB in folders). */
  label?: string;
  /** Descenders: distance from screen bottom. Defaults to 28. */
  bottom?: number;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: colors.primary,
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    fabPressed: {
      transform: [{ scale: 0.94 }],
      opacity: 0.9,
    },
  });

export default function FAB({ onPress, icon = 'camera', label, bottom }: FABProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Scan new document'}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.fab,
        { bottom: bottom ?? 28 },
        pressed && styles.fabPressed,
      ]}
    >
      <Ionicons name={icon} size={30} color={colors.onPrimary} />
    </Pressable>
  );
}
