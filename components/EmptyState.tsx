import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/Buttons';
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
    actionWrap: {
      marginTop: spacing.lg,
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
        <PrimaryButton
          label={action.label}
          icon="add"
          onPress={action.onPress}
          style={styles.actionWrap}
        />
      ) : null}
    </View>
  );
}
