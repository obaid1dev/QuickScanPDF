import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDocuments } from '@/hooks/useDocuments';
import {
  getScansDirectory,
  getTotalScansSizeBytes,
} from '@/lib/fileManager';
import { ADS_ENABLED, APP_VERSION } from '@/constants/config';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function SettingsScreen() {
  const { documents, remove, refresh, totalStorageLabel } = useDocuments();
  const [clearing, setClearing] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const clearAllScans = async () => {
    setConfirmVisible(false);
    setClearing(true);
    try {
      const dir = getScansDirectory();
      for (const entry of dir.list()) {
        try {
          entry.delete();
        } catch {
          // best-effort deletion per file
        }
      }
      for (const doc of [...documents]) {
        await remove(doc.id);
      }
      await refresh();
    } finally {
      setClearing(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
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
              Deletes {documents.length} scan{documents.length === 1 ? '' : 's'} •{' '}
              {getTotalScansSizeBytes() > 0 ? totalStorageLabel : '0 KB'}
            </Text>
          </View>
          <Pressable
            onPress={() => setConfirmVisible(true)}
            disabled={clearing || documents.length === 0}
            style={styles.dangerBtn}
          >
            <Text style={styles.dangerBtnText}>
              {clearing ? '…' : 'Clear'}
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
            ? `This permanently deletes all ${documents.length} scan${documents.length === 1 ? '' : 's'} (PDFs and thumbnails) from your device.`
            : 'This permanently deletes every scan (PDFs and thumbnails) from your device.'
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
              {ADS_ENABLED ? 'Ad-supported (banner + interstitial)' : 'Ad-free — no third-party trackers.'}
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
              QuickScan PDF v{APP_VERSION} is 100% offline. All scans and
              documents are stored locally on your device nothing is uploaded to
              the cloud.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    rowGap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
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
    color: colors.danger,
    marginBottom: 4,
  },
  rowSub: {
    ...typography.secondary,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  dangerBtn: {
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  dangerBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});