import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface ProcessingLoaderProps {
  message?: string;
}

export default function ProcessingLoader({
  message = 'Generating your PDF…',
}: ProcessingLoaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  message: {
    ...typography.secondary,
    color: colors.textSecondary,
  },
});