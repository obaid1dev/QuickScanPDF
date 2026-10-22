import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { OcrSheetState } from '@/hooks/useOcrFlow';
import { radii, spacing, typography, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface OcrSheetProps {
  state: OcrSheetState;
  onClose: () => void;
}

/**
 * Full-height results sheet for on-device text recognition: scrollable,
 * selectable text plus Copy and "Share as .txt". Reports a friendly message
 * when a scan yields nothing and never blocks on its own errors.
 */
export default function OcrSheet({ state, onClose }: OcrSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  const hasText = state.status === 'result' && state.text.trim().length > 0;

  const copy = useCallback(async () => {
    if (!hasText) {
      return;
    }
    try {
      await Clipboard.setStringAsync(state.text);
      void Haptics.selectionAsync();
      setCopied(true);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      Alert.alert(
        'Could not copy',
        'The extracted text could not be copied to the clipboard.',
      );
    }
  }, [hasText, state.text]);

  const shareTxt = useCallback(async () => {
    if (!hasText) {
      return;
    }
    void Haptics.selectionAsync();
    try {
      const file = new File(
        Paths.cache,
        `quickscan_text_${Date.now()}.txt`,
      );
      if (file.exists) {
        file.delete();
      }
      file.write(state.text);
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: state.label,
        UTI: 'public.plain-text',
      });
    } catch (e) {
      Alert.alert(
        'Could not share',
        e instanceof Error
          ? e.message
          : 'The text file could not be shared.',
      );
    }
  }, [hasText, state.text, state.label]);

  return (
    <Modal
      visible={state.visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerBody}>
            <Text style={styles.title} numberOfLines={1}>
              {state.label || 'Extracted text'}
            </Text>
            <Text style={styles.subtitle}>Recognized on your device</Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            accessibilityLabel="Close extracted text"
          >
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {state.status === 'loading' ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.statusText}>Reading text…</Text>
            </View>
          ) : state.status === 'error' ? (
            <View style={styles.centered}>
              <Ionicons
                name="alert-circle-outline"
                size={40}
                color={colors.danger}
              />
              <Text style={styles.emptyText}>
                {state.error || 'Something went wrong while reading this scan.'}
              </Text>
            </View>
          ) : hasText ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text selectable style={styles.extractedText}>
                {state.text}
              </Text>
            </ScrollView>
          ) : (
            <View style={styles.centered}>
              <Ionicons
                name="document-text-outline"
                size={40}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>
                No text detected, try a clearer, well-lit scan.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={() => void copy()}
            disabled={!hasText}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.secondaryBtn,
              (!hasText || pressed) && styles.dimmed,
            ]}
            accessibilityLabel="Copy extracted text"
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={18}
              color={hasText ? colors.textPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.secondaryBtnText,
                !hasText && styles.dimmedLabel,
              ]}
            >
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void shareTxt()}
            disabled={!hasText}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.primaryBtn,
              (!hasText || pressed) && styles.dimmed,
            ]}
            accessibilityLabel="Share extracted text as a text file"
          >
            <Ionicons
              name="share-outline"
              size={18}
              color={hasText ? colors.onPrimary : colors.textSecondary}
            />
            <Text style={[styles.primaryBtnText, !hasText && styles.dimmedLabel]}>
              Share as .txt
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
  headerBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    fontSize: 16,
  },
  subtitle: {
    ...typography.badge,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    rowGap: spacing.md,
  },
  statusText: {
    ...typography.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  extractedText: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 23,
  },
  footer: {
    flexDirection: 'row',
    columnGap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    borderRadius: radii.round,
    paddingVertical: 14,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceLighter,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  dimmed: {
    opacity: 0.6,
  },
  dimmedLabel: {
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
