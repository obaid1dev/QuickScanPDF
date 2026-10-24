import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  /** Optional themed call-to-action rendered under the subtitle. */
  action?: {
    label: string;
    onPress: () => void;
  };
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl * 2,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 18,
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radii.round,
      paddingHorizontal: spacing.xl,
      paddingVertical: 12,
      marginTop: spacing.lg,
    },
    actionBtnPressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.9,
    },
    actionLabel: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
  });

export default function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={44} color={colors.textSecondary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && styles.actionBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Ionicons name="add" size={18} color={colors.onPrimary} />
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
