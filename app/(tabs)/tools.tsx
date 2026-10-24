import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import {
  radii,
  spacing,
  typography,
  type Palette,
} from '@/constants/theme';

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    title: {
      ...typography.screenTitle,
      color: colors.textPrimary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      rowGap: spacing.md,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: radii.lg,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    headline: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      fontSize: 18,
      textAlign: 'center',
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 320,
    },
    chip: {
      backgroundColor: colors.accentPill,
      borderRadius: radii.round,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    chipLabel: {
      ...typography.badge,
      color: colors.primary,
      fontWeight: '700',
    },
  });

/**
 * Tools tab placeholder. Deliberately static: no interactive elements until
 * real tools ship — per the release scope, this screen shows a "Coming soon"
 * message and nothing else.
 */
export default function ToolsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Tools</Text>
      </View>

      <View style={styles.centered}>
        <View style={styles.iconWrap}>
          <Ionicons name="construct-outline" size={44} color={colors.primary} />
        </View>
        <Text style={styles.headline}>PDF tools are on the way</Text>
        <Text style={styles.body}>
          Signature, merge, split and more are being built right into the app.
          Keep QuickScan PDF updated — they'll appear here.
        </Text>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Coming soon</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
