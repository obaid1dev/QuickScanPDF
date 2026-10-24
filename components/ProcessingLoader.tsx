import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface ProcessingLoaderProps {
  message?: string;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    card: {
      alignItems: 'center',
      rowGap: spacing.lg,
      padding: spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
    },
    message: {
      ...typography.secondary,
      color: colors.textSecondary,
    },
  });

export default function ProcessingLoader({
  message = 'Generating your PDF...',
}: ProcessingLoaderProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}
