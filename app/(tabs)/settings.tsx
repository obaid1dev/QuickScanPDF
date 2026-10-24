import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDocuments } from '@/hooks/useDocuments';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ADS_ENABLED, APP_VERSION } from '@/constants/config';
import {
  radii,
  spacing,
  typography,
  type Palette,
  type ThemeSetting,
} from '@/constants/theme';

const THEME_OPTIONS: Array<{ value: ThemeSetting; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

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
    content: {
      padding: spacing.xl,
      paddingTop: spacing.sm,
      rowGap: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: spacing.md,
    },
    rowBody: {
      flex: 1,
    },
    rowTitle: {
      ...typography.cardTitle,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    rowTitleDanger: {
      ...typography.cardTitle,
      color: colors.dangerText,
      marginBottom: 4,
    },
    rowSub: {
      ...typography.secondary,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    themeRow: {
      marginTop: spacing.md,
      flexDirection: 'row',
      columnGap: spacing.sm,
    },
    themeOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    themeOptionPressed: {
      transform: [{ scale: 0.97 }],
    },
    themeOptionLabel: {
      ...typography.secondary,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    themeOptionLabelActive: {
      color: colors.primary,
    },
    dangerBtn: {
      backgroundColor: colors.danger,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    dangerBtnPressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.9,
    },
    dangerBtnText: {
      color: colors.onDanger,
      fontSize: 13,
      fontWeight: '700',
    },
  });

export default function SettingsScreen() {
  const { colors, setting, setSetting } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { documents, clearAll, totalStorageBytes, totalStorageLabel } = useDocuments();
  const [clearing, setClearing] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const clearAllScans = async () => {
    setConfirmVisible(false);
    setClearing(true);
    try {
      // One batch operation: all files removed, all metadata cleared in a
      // single write. The Dashboard's list and the storage stat both update
      // from this one state change, so the empty state appears instantly.
      await clearAll();
    } catch {
      // Deletion is best-effort; clearAll already drops the metadata index so
      // there is never a dangling entry for a file that failed to delete.
    } finally {
      setClearing(false);
    }
  };

  const pickTheme = (next: ThemeSetting) => {
    if (next === setting) {
      return;
    }
    void Haptics.selectionAsync();
    setSetting(next);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="contrast-outline" size={20} color={colors.textSecondary} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Theme</Text>
              <Text style={styles.rowSub}>
                Light or dark - your choice is remembered.
              </Text>
            </View>
          </View>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const active = setting === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => pickTheme(option.value)}
                  style={({ pressed }) => [
                    styles.themeOption,
                    active && styles.themeOptionActive,
                    pressed && styles.themeOptionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} theme`}
                  accessibilityState={{ selected: setting === option.value }}
                >
                  <Text
                    style={[
                      styles.themeOptionLabel,
                      active && styles.themeOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="server-outline" size={20} color={colors.textSecondary} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Storage used by scans</Text>
              <Text style={styles.rowSub}>{totalStorageLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitleDanger}>Clear all scans</Text>
              <Text style={styles.rowSub}>
                Deletes {documents.length} scan{documents.length === 1 ? '' : 's'} -{' '}
                {totalStorageBytes > 0 ? totalStorageLabel : '0 KB'}
              </Text>
            </View>
            <Pressable
              onPress={() => setConfirmVisible(true)}
              disabled={clearing || documents.length === 0}
              style={({ pressed }) => [
                styles.dangerBtn,
                pressed && styles.dangerBtnPressed,
              ]}
            >
              <Text style={styles.dangerBtnText}>
                {clearing ? '...' : 'Clear'}
              </Text>
            </Pressable>
          </View>
        </View>

        <ConfirmDialog
          visible={confirmVisible}
          icon="trash-outline"
          title="Clear all scans?"
          message={
            documents.length > 0
              ? `This will permanently delete all ${documents.length} scan${documents.length === 1 ? '' : 's'} and their PDFs from this device. This cannot be undone.`
              : 'This will permanently delete all scanned documents and PDFs from this device. This cannot be undone.'
          }
          confirmLabel="Delete All"
          danger
          onConfirm={clearAllScans}
          onCancel={() => setConfirmVisible(false)}
        />

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="megaphone-outline" size={20} color={colors.textSecondary} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Ads in app</Text>
              <Text style={styles.rowSub}>
                {ADS_ENABLED
                  ? 'Ad-supported (banner, viewer banner, interstitial and optional rewarded ads)'
                  : 'Ad-free - no third-party trackers.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>About</Text>
              <Text style={styles.rowSub}>
                QuickScan PDF v{APP_VERSION} is 100% offline. Copy text from scans
                with on-device text recognition. All scans and documents are stored
                locally on your device - nothing is uploaded to the cloud.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
